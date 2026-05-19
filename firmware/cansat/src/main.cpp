// ============================================================
//  ESP32-S3 — CANSAT FULL INTEGRATED
//  Based exactly on your working sensor code
//  Added: ESP32-CAM UART + geo-referencing + image chunking
//  Updated: MQ135 for AQI (replaces MQ2)
//  Updated: Kalman filter replaces complementary filter
//
//  I2C  : SDA=GPIO8   SCL=GPIO9
//  GPS  : RX=GPIO40   TX=GPIO39
//  CAM  : RX=GPIO41   TX=GPIO42
//  MQ135: AO=GPIO4
//  Ground Station MAC: 84:CC:A8:0F:12:0C
// ============================================================
#include <Wire.h>
#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>
#include <MPU6050.h>
#include <QMC5883LCompass.h>
#include <Adafruit_BMP280.h>
#include <HardwareSerial.h>
#include <TinyGPSPlus.h>
#include <math.h>

// ── Ground station MAC ───────────────────────────────────────
uint8_t GROUND_STATION_MAC[] = {0x84, 0xCC, 0xA8, 0x0F, 0x12, 0x0C};

// ── Sensor objects ───────────────────────────────────────────
MPU6050         mpu;
QMC5883LCompass compass;
Adafruit_BMP280 bmp;
HardwareSerial  GPSSerial(1);
HardwareSerial  CamSerial(2);
TinyGPSPlus     gps;

// ── Status flags ─────────────────────────────────────────────
bool mpu_ok     = false;
bool compass_ok = false;
bool bmp_ok     = false;
bool mq135_ok   = false;
bool cam_ok     = false;

// ── Pins ─────────────────────────────────────────────────────
#define GPS_RX    40
#define GPS_TX    39
#define CAM_RX    41
#define CAM_TX    42
#define MQ135_AO   4

// ── Camera protocol ──────────────────────────────────────────
#define CMD_CAPTURE  0xA1
#define RESP_READY   0xB0
#define RESP_START   0xB1
#define RESP_END     0xB2
#define RESP_ERROR   0xB3

// ── MPU6050 calibration ──────────────────────────────────────
const float ACCEL_X_OFFSET =   286.59f;
const float ACCEL_Y_OFFSET =   364.61f;
const float ACCEL_Z_OFFSET =  -309.29f;
const float GYRO_X_OFFSET  =   261.43f;
const float GYRO_Y_OFFSET  =  -184.61f;
const float GYRO_Z_OFFSET  =  -102.44f;
const float ACCEL_SCALE    = 16384.0f;
const float GYRO_SCALE     =   131.0f;

// ── QMC5883L calibration ─────────────────────────────────────
const float X_OFFSET      = -134.00f;
const float Y_OFFSET      =  232.00f;
const float Z_OFFSET      =   51.00f;
const float X_SCALE       =   1.1526f;
const float Y_SCALE       =   0.9647f;
const float Z_SCALE       =   0.9126f;
const float DECLINATION   =   1.5f;
const float MOUNT_OFFSET  =  -3.3f;
const float ALPHA_SLOW    =   0.15f;
const float ALPHA_FAST    =   0.85f;
const float STABLE_THRESH =   5.0f;
const float FAST_THRESH   =  25.0f;

// ── MQ135 constants ──────────────────────────────────────────
const float RL           = 10.0f;
const float RO_CLEAN_AIR =  3.6f;

const float CO2_A     = 110.47f,  CO2_B     = -2.862f;
const float NH3_A     = 102.20f,  NH3_B     = -2.473f;
const float CO_A      = 605.18f,  CO_B      = -3.937f;
const float ALCOHOL_A =  77.255f, ALCOHOL_B = -3.180f;
const float BENZENE_A =  34.668f, BENZENE_B = -3.369f;

float Ro = 10.0f;

// ── Kalman Filter ─────────────────────────────────────────────
typedef struct KalmanState {
  float angle;
  float bias;
  float P[2][2];
} KalmanState;

KalmanState kalman_roll;
KalmanState kalman_pitch;

const float KAL_Q_ANGLE   = 0.001f;
const float KAL_Q_BIAS    = 0.003f;
const float KAL_R_MEASURE = 0.03f;

float filter_yaw      = 0.0f;
float smoothedHeading = -1.0f;

// ── Timing ───────────────────────────────────────────────────
unsigned long lastMPU      = 0;
unsigned long lastMPUPrint = 0;
unsigned long lastCompass  = 0;
unsigned long lastBMP      = 0;
unsigned long lastGPS      = 0;
unsigned long lastSend     = 0;
unsigned long lastCapture  = 0;

const unsigned long MPU_INTERVAL       =   10;
const unsigned long MPU_PRINT_INTERVAL =  500;
const unsigned long COMPASS_INTERVAL   =  100;
const unsigned long BMP_INTERVAL       = 1000;
const unsigned long GPS_INTERVAL       = 1000;
const unsigned long SEND_INTERVAL      = 1000;
const unsigned long CAPTURE_INTERVAL   = 5000;

// ── Sensor packet ─────────────────────────────────────────────
typedef struct SensorPacket {
  float    roll, pitch, yaw;
  float    ax, ay, az;
  float    gx, gy, gz;
  float    accel_mag;
  float    heading;
  char     direction[4];
  float    temperature;
  float    pressure;
  float    bmp_altitude;
  float    latitude;
  float    longitude;
  float    gps_altitude;
  float    speed_kmh;
  float    course;
  int      satellites;
  int      gps_hour, gps_min, gps_sec;
  int      gps_day,  gps_month, gps_year;
  bool     gps_valid;
  float    co2_ppm;
  float    nh3_ppm;
  float    co_ppm;
  float    alcohol_ppm;
  float    benzene_ppm;
  float    aqi_index;
  char     aqi_level[24];
  float    img_center_lat;
  float    img_center_lon;
  float    img_ground_dist;
  float    img_tilt_angle;
  bool     img_captured;
  uint32_t img_id;
  uint32_t packetID;
  uint32_t timestamp_ms;
} SensorPacket;

// ── Image chunk packet ────────────────────────────────────────
#define IMG_CHUNK_SIZE 200U

typedef struct ImageChunk {
  uint8_t  pkt_type;
  uint32_t img_id;
  uint16_t chunk_index;
  uint16_t total_chunks;
  uint32_t total_size;
  uint16_t data_len;
  uint8_t  data[IMG_CHUNK_SIZE];
  float    geo_lat;
  float    geo_lon;
  float    geo_alt;
  float    geo_roll;
  float    geo_pitch;
  float    geo_heading;
} ImageChunk;

SensorPacket packet;
uint32_t     packetCounter = 0;
uint32_t     imageCounter  = 0;

#define MAX_IMG_SIZE 51200U
uint8_t  imgBuffer[MAX_IMG_SIZE];
uint32_t imgSize = 0;

// ── ESP-NOW send callback (compatible with Arduino-ESP32 2.x and 3.x) ──
#ifndef ESP_ARDUINO_VERSION
#define ESP_ARDUINO_VERSION 0
#endif
#if ESP_ARDUINO_VERSION >= 0x30000
void onSent(const wifi_tx_info_t *info, esp_now_send_status_t status) {
  (void)info; (void)status;
}
#else
void onSent(const uint8_t *mac_addr, esp_now_send_status_t status) {
  (void)mac_addr; (void)status;
}
#endif

// ── Prototypes ────────────────────────────────────────────────
void        kalmanInit(KalmanState &k, float initAngle);
float       kalmanUpdate(KalmanState &k, float newAngle, float newRate, float dt);
float       readHeading();
float       adaptiveSmooth(float h);
float       circularDiff(float a, float b);
const char* headingToDirection(float h);
float       readRs();
float       getPPM(float rs_ro, float a, float b);
float       calcAQI(float co2, float co, float nh3);
const char* getAQILevel(float aqi);
void        predictImageCenter(float lat, float lon, float alt,
                               float roll, float pitch, float heading,
                               float &img_lat, float &img_lon,
                               float &dist, float &tilt);
bool        triggerCamera();
void        sendImageChunks(uint32_t img_id, float geo_lat, float geo_lon,
                            float geo_alt, float geo_roll, float geo_pitch,
                            float geo_heading);

// ============================================================
//  KALMAN FILTER
// ============================================================
void kalmanInit(KalmanState &k, float initAngle) {
  k.angle   = initAngle;
  k.bias    = 0.0f;
  k.P[0][0] = 0.0f;
  k.P[0][1] = 0.0f;
  k.P[1][0] = 0.0f;
  k.P[1][1] = 0.0f;
}

float kalmanUpdate(KalmanState &k, float newAngle, float newRate, float dt) {
  float rate = newRate - k.bias;
  k.angle   += dt * rate;
  k.P[0][0] += dt * (dt * k.P[1][1] - k.P[0][1] - k.P[1][0] + KAL_Q_ANGLE);
  k.P[0][1] -= dt * k.P[1][1];
  k.P[1][0] -= dt * k.P[1][1];
  k.P[1][1] += dt * KAL_Q_BIAS;
  float S  = k.P[0][0] + KAL_R_MEASURE;
  float K0 = k.P[0][0] / S;
  float K1 = k.P[1][0] / S;
  float y  = newAngle - k.angle;
  k.angle += K0 * y;
  k.bias  += K1 * y;
  float P00 = k.P[0][0];
  float P01 = k.P[0][1];
  k.P[0][0] -= K0 * P00;
  k.P[0][1] -= K0 * P01;
  k.P[1][0] -= K1 * P00;
  k.P[1][1] -= K1 * P01;
  return k.angle;
}

// ============================================================
//  SETUP
// ============================================================
void setup() {
  Serial.begin(115200);
  unsigned long t = millis();
  while (!Serial && (millis() - t < 3000));
  delay(500);

  Serial.println();
  Serial.println("╔══════════════════════════════════════════╗");
  Serial.println("║  ESP32-S3 CanSat — Full Integration      ║");
  Serial.println("║  Sensors + Camera + Geo-Reference        ║");
  Serial.println("╚══════════════════════════════════════════╝");

  // ── WiFi / ESP-NOW ────────────────────────────────────────
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  delay(300);

  uint8_t myMac[6];
  esp_wifi_get_mac(WIFI_IF_STA, myMac);
  Serial.printf("  My MAC    : %02X:%02X:%02X:%02X:%02X:%02X\n",
    myMac[0],myMac[1],myMac[2],myMac[3],myMac[4],myMac[5]);
  Serial.printf("  Target MAC: %02X:%02X:%02X:%02X:%02X:%02X\n",
    GROUND_STATION_MAC[0],GROUND_STATION_MAC[1],GROUND_STATION_MAC[2],
    GROUND_STATION_MAC[3],GROUND_STATION_MAC[4],GROUND_STATION_MAC[5]);

  if (esp_now_init() != ESP_OK) {
    Serial.println("  ESP-NOW init failed!"); while(1) delay(1000);
  }
  esp_now_register_send_cb(onSent);

  esp_now_peer_info_t peer = {};
  memcpy(peer.peer_addr, GROUND_STATION_MAC, 6);
  peer.channel = 0;
  peer.encrypt = false;
  if (esp_now_add_peer(&peer) != ESP_OK) {
    Serial.println("  Failed to add peer!"); while(1) delay(1000);
  }
  Serial.println("  ESP-NOW  ready");

  // ── I2C + UART ────────────────────────────────────────────
  Wire.begin(8, 9);
  Wire.setClock(400000);
  GPSSerial.begin(9600,   SERIAL_8N1, GPS_RX, GPS_TX);
  CamSerial.begin(921600, SERIAL_8N1, CAM_RX, CAM_TX);

  // ── MQ135 pin init ────────────────────────────────────────
  pinMode(MQ135_AO, INPUT);
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);

  // ── MPU6050 ───────────────────────────────────────────────
  Serial.print("  MPU6050... ");
  Wire.beginTransmission(0x68);
  if (Wire.endTransmission() == 0) {
    mpu.initialize();
    delay(100);
    if (mpu.testConnection()) {
      mpu.setFullScaleAccelRange(MPU6050_ACCEL_FS_2);
      mpu.setFullScaleGyroRange(MPU6050_GYRO_FS_250);
      mpu.setDLPFMode(MPU6050_DLPF_BW_20);
      int16_t ax,ay,az,gx,gy,gz;
      for (int i=0;i<100;i++) { mpu.getMotion6(&ax,&ay,&az,&gx,&gy,&gz); delay(2); }
      mpu.getMotion6(&ax,&ay,&az,&gx,&gy,&gz);
      float fax = (ax + ACCEL_X_OFFSET) / ACCEL_SCALE;
      float fay = (ay + ACCEL_Y_OFFSET) / ACCEL_SCALE;
      float faz = (az + ACCEL_Z_OFFSET) / ACCEL_SCALE;
      float init_roll  = atan2f(fay, faz) * 180.0f / M_PI;
      float init_pitch = atan2f(-fax, sqrtf(fay*fay + faz*faz)) * 180.0f / M_PI;
      kalmanInit(kalman_roll,  init_roll);
      kalmanInit(kalman_pitch, init_pitch);
      mpu_ok = true;
      Serial.println("OK");
    } else Serial.println("not responding");
  } else Serial.println("not found at 0x68");

  // ── QMC5883L ──────────────────────────────────────────────
  Serial.print("  QMC5883L... ");
  Wire.beginTransmission(0x0D);
  if (Wire.endTransmission() == 0) {
    compass.init();
    delay(50);
    compass.setMode(0x01, 0x0C, 0x10, 0x00);
    delay(100);
    compass.read();
    if (compass.getX()!=0 || compass.getY()!=0 || compass.getZ()!=0) {
      smoothedHeading = readHeading();
      compass_ok = true;
      Serial.println("OK");
    } else Serial.println("not responding");
  } else Serial.println("not found at 0x0D");

  // ── BMP280 ────────────────────────────────────────────────
  Serial.print("  BMP280... ");
  if (bmp.begin(0x76)) {
    bmp.setSampling(Adafruit_BMP280::MODE_NORMAL,
                    Adafruit_BMP280::SAMPLING_X2,
                    Adafruit_BMP280::SAMPLING_X16,
                    Adafruit_BMP280::FILTER_X16,
                    Adafruit_BMP280::STANDBY_MS_500);
    float temp = bmp.readTemperature();
    if (temp > -40.0f && temp < 85.0f) {
      bmp_ok = true; Serial.println("OK");
    } else Serial.println("invalid readings");
  } else Serial.println("not found at 0x76");

  // ── MQ135 warm-up & calibration ───────────────────────────
  Serial.print("  MQ135 warming up");
  for (int i = 0; i < 30; i++) {
    delay(1000);
    if (i % 5 == 0) Serial.print(".");
  }
  Serial.println();

  Serial.print("  MQ135 calibrating");
  float sum = 0.0f;
  int   validReads = 0;
  for (int i = 0; i < 50; i++) {
    float rs = readRs();
    if (rs > 0.1f && rs < 100.0f) { sum += rs; validReads++; }
    delay(50);
    if (i % 10 == 0) Serial.print(".");
  }
  if (validReads > 25) {
    Ro = (sum / (float)validReads) / RO_CLEAN_AIR;
    mq135_ok = true;
    Serial.printf("  OK  Ro=%.2f kOhm\n", Ro);
  } else {
    Serial.println("  unstable — using default Ro");
  }

  // ── ESP32-CAM handshake ───────────────────────────────────
  Serial.print("  ESP32-CAM... ");
  unsigned long camWait = millis();
  while (millis() - camWait < 6000) {
    if (CamSerial.available()) {
      uint8_t b = (uint8_t)CamSerial.read();
      if (b == RESP_READY) { cam_ok = true; break; }
    }
    delay(10);
  }
  Serial.println(cam_ok ? "OK" : "no response (check wiring)");

  // ── GPS ───────────────────────────────────────────────────
  Serial.println("  NEO-6M   ready (acquiring fix...)");

  Serial.println();
  Serial.printf("  Sensors: MPU:%s COMP:%s BMP:%s MQ135:%s CAM:%s\n",
    mpu_ok?"OK":"--", compass_ok?"OK":"--", bmp_ok?"OK":"--",
    mq135_ok?"OK":"--", cam_ok?"OK":"--");
  Serial.println("  Starting main loop...\n");

  memset(&packet, 0, sizeof(packet));
  strcpy(packet.direction, "N");
  strcpy(packet.aqi_level, "UNKNOWN");

  lastMPU = lastMPUPrint = lastCompass =
  lastBMP = lastGPS      = lastSend    =
  lastCapture             = millis();
}

// ============================================================
//  LOOP
// ============================================================
void loop() {
  unsigned long now = millis();

  // ── GPS feed ──────────────────────────────────────────────
  while (GPSSerial.available() > 0)
    gps.encode(GPSSerial.read());

  // ── MPU6050 @ 100Hz ───────────────────────────────────────
  if (mpu_ok && (now - lastMPU >= MPU_INTERVAL)) {
    float dt = (float)(now - lastMPU) / 1000.0f;
    lastMPU = now;
    int16_t r_ax,r_ay,r_az,r_gx,r_gy,r_gz;
    mpu.getMotion6(&r_ax,&r_ay,&r_az,&r_gx,&r_gy,&r_gz);
    float ax  = ((float)r_ax + ACCEL_X_OFFSET) / ACCEL_SCALE;
    float ay  = ((float)r_ay + ACCEL_Y_OFFSET) / ACCEL_SCALE;
    float az  = ((float)r_az + ACCEL_Z_OFFSET) / ACCEL_SCALE;
    float gxf = ((float)r_gx + GYRO_X_OFFSET)  / GYRO_SCALE;
    float gyf = ((float)r_gy + GYRO_Y_OFFSET)  / GYRO_SCALE;
    float gzf = ((float)r_gz + GYRO_Z_OFFSET)  / GYRO_SCALE;
    float acc_roll  = atan2f(ay, az) * 180.0f / M_PI;
    float acc_pitch = atan2f(-ax, sqrtf(ay*ay + az*az)) * 180.0f / M_PI;
    float roll  = kalmanUpdate(kalman_roll,  acc_roll,  gxf, dt);
    float pitch = kalmanUpdate(kalman_pitch, acc_pitch, gyf, dt);
    filter_yaw  = filter_yaw + gzf * dt;
    packet.roll      = roll;
    packet.pitch     = pitch;
    packet.yaw       = filter_yaw;
    packet.ax        = ax;
    packet.ay        = ay;
    packet.az        = az;
    packet.gx        = gxf;
    packet.gy        = gyf;
    packet.gz        = gzf;
    packet.accel_mag = sqrtf(ax*ax + ay*ay + az*az);
    if (now - lastMPUPrint >= MPU_PRINT_INTERVAL) {
      lastMPUPrint = now;
      Serial.printf("  IMU  R:%+6.1f  P:%+6.1f  Y:%+6.1f  |a|:%.3fg\n",
        roll, pitch, filter_yaw, packet.accel_mag);
    }
  }

  // ── QMC5883L @ 10Hz ───────────────────────────────────────
  if (compass_ok && (now - lastCompass >= COMPASS_INTERVAL)) {
    lastCompass = now;
    float h = adaptiveSmooth(readHeading());
    packet.heading = h;
    strncpy(packet.direction, headingToDirection(h), 3);
    packet.direction[3] = '\0';
  }

  // ── BMP280 @ 1Hz ──────────────────────────────────────────
  if (bmp_ok && (now - lastBMP >= BMP_INTERVAL)) {
    lastBMP             = now;
    packet.temperature  = bmp.readTemperature();
    packet.pressure     = bmp.readPressure() / 100.0f;
    packet.bmp_altitude = bmp.readAltitude(1013.25f);
  }

  // ── GPS @ 1Hz ─────────────────────────────────────────────
  if (now - lastGPS >= GPS_INTERVAL) {
    lastGPS             = now;
    packet.gps_valid    = gps.location.isValid();
    packet.latitude     = gps.location.isValid()   ? (float)gps.location.lat()    : 0.0f;
    packet.longitude    = gps.location.isValid()   ? (float)gps.location.lng()    : 0.0f;
    packet.gps_altitude = gps.altitude.isValid()   ? (float)gps.altitude.meters() : 0.0f;
    packet.speed_kmh    = gps.speed.isValid()      ? (float)gps.speed.kmph()      : 0.0f;
    packet.course       = gps.course.isValid()     ? (float)gps.course.deg()      : 0.0f;
    packet.satellites   = gps.satellites.isValid() ? (int)gps.satellites.value()  : 0;
    packet.gps_hour     = gps.time.isValid()       ? (int)gps.time.hour()         : 0;
    packet.gps_min      = gps.time.isValid()       ? (int)gps.time.minute()       : 0;
    packet.gps_sec      = gps.time.isValid()       ? (int)gps.time.second()       : 0;
    packet.gps_day      = gps.date.isValid()       ? (int)gps.date.day()          : 0;
    packet.gps_month    = gps.date.isValid()       ? (int)gps.date.month()        : 0;
    packet.gps_year     = gps.date.isValid()       ? (int)gps.date.year()         : 0;
  }

  // ── Camera capture + geo-ref @ 5s ─────────────────────────
  if (cam_ok && (now - lastCapture >= CAPTURE_INTERVAL)) {
    lastCapture = now;

    float snap_lat     = packet.latitude;
    float snap_lon     = packet.longitude;
    float snap_roll    = packet.roll;
    float snap_pitch   = packet.pitch;
    float snap_heading = packet.heading;
    float snap_alt     = (packet.bmp_altitude > 0.0f)
                         ? packet.bmp_altitude : packet.gps_altitude;

    if (triggerCamera()) {
      uint32_t this_img_id = ++imageCounter;

      predictImageCenter(snap_lat, snap_lon, snap_alt,
                         snap_roll, snap_pitch, snap_heading,
                         packet.img_center_lat, packet.img_center_lon,
                         packet.img_ground_dist, packet.img_tilt_angle);

      packet.img_captured = true;
      packet.img_id       = this_img_id;

      Serial.printf("  CAM  Image #%lu  %lu bytes\n",
        (unsigned long)this_img_id, (unsigned long)imgSize);
      Serial.printf("       Tilt:%.1f deg  Offset:%.1f m\n",
        packet.img_tilt_angle, packet.img_ground_dist);
      Serial.printf("       Center: %.6f, %.6f\n",
        packet.img_center_lat, packet.img_center_lon);
      Serial.printf("       Maps: https://maps.google.com/?q=%.6f,%.6f\n",
        packet.img_center_lat, packet.img_center_lon);

      sendImageChunks(this_img_id, snap_lat, snap_lon, snap_alt,
                      snap_roll, snap_pitch, snap_heading);
    } else {
      packet.img_captured = false;
    }
  }

  // ── MQ135 + send packet @ 1Hz ─────────────────────────────
  if (now - lastSend >= SEND_INTERVAL) {
    lastSend = now;

    if (mq135_ok) {
      float rs    = readRs();
      float rs_ro = rs / Ro;

      packet.co2_ppm     = getPPM(rs_ro, CO2_A,     CO2_B);
      packet.nh3_ppm     = getPPM(rs_ro, NH3_A,     NH3_B);
      packet.co_ppm      = getPPM(rs_ro, CO_A,      CO_B);
      packet.alcohol_ppm = getPPM(rs_ro, ALCOHOL_A, ALCOHOL_B);
      packet.benzene_ppm = getPPM(rs_ro, BENZENE_A, BENZENE_B);
      packet.aqi_index   = calcAQI(packet.co2_ppm, packet.co_ppm, packet.nh3_ppm);
      strncpy(packet.aqi_level, getAQILevel(packet.aqi_index), 23);
      packet.aqi_level[23] = '\0';

      Serial.printf("  MQ135  CO2:%.1f  CO:%.1f  NH3:%.1f  "
                    "Alcohol:%.1f  Benzene:%.1f  AQI:%.1f [%s]\n",
        packet.co2_ppm, packet.co_ppm, packet.nh3_ppm,
        packet.alcohol_ppm, packet.benzene_ppm,
        packet.aqi_index, packet.aqi_level);
    }

    packet.packetID     = ++packetCounter;
    packet.timestamp_ms = now;

    esp_err_t r = esp_now_send(GROUND_STATION_MAC,
                               (uint8_t*)&packet, sizeof(packet));
    Serial.printf("  PKT #%lu  GPS:%s  IMG:%s  [%s]\n",
      (unsigned long)packetCounter,
      packet.gps_valid    ? "FIX" : "---",
      packet.img_captured ? "NEW" : "---",
      r == ESP_OK         ? "sent" : "FAIL");

    packet.img_captured = false;
  }
}

// ============================================================
//  CAMERA
// ============================================================
bool triggerCamera() {
  while (CamSerial.available()) CamSerial.read();
  CamSerial.write((uint8_t)CMD_CAPTURE);

  unsigned long t = millis();
  while (millis() - t < 3000) {
    if (CamSerial.available()) {
      uint8_t b = (uint8_t)CamSerial.read();
      if (b == RESP_START) goto got_start;
      if (b == RESP_ERROR) { Serial.println("  CAM: error response"); return false; }
    }
  }
  Serial.println("  CAM: timeout waiting RESP_START");
  return false;

got_start:
  t = millis();
  while (CamSerial.available() < 4 && millis() - t < 2000);
  if (CamSerial.available() < 4) { Serial.println("  CAM: size timeout"); return false; }

  uint32_t sz = 0;
  sz |= ((uint32_t)(uint8_t)CamSerial.read()) << 24;
  sz |= ((uint32_t)(uint8_t)CamSerial.read()) << 16;
  sz |= ((uint32_t)(uint8_t)CamSerial.read()) <<  8;
  sz |= ((uint32_t)(uint8_t)CamSerial.read());

  if (sz == 0 || sz > MAX_IMG_SIZE) {
    Serial.printf("  CAM: bad size %lu\n", (unsigned long)sz);
    return false;
  }

  imgSize = 0;
  t = millis();
  while (imgSize < sz && millis() - t < 10000) {
    if (CamSerial.available()) imgBuffer[imgSize++] = (uint8_t)CamSerial.read();
  }

  if (imgSize != sz) {
    Serial.printf("  CAM: incomplete %lu/%lu\n",
      (unsigned long)imgSize, (unsigned long)sz);
    return false;
  }

  t = millis();
  while (millis() - t < 1000) {
    if (CamSerial.available() && (uint8_t)CamSerial.read() == RESP_END) return true;
  }
  return (imgSize == sz);
}

// ============================================================
//  SEND IMAGE CHUNKS
// ============================================================
void sendImageChunks(uint32_t img_id, float geo_lat, float geo_lon,
                     float geo_alt, float geo_roll, float geo_pitch,
                     float geo_heading) {
  if (imgSize == 0) return;

  uint16_t total = (uint16_t)((imgSize + IMG_CHUNK_SIZE - 1U) / IMG_CHUNK_SIZE);
  Serial.printf("  Sending image %lu: %u chunks\n",
    (unsigned long)img_id, (unsigned int)total);

  ImageChunk chunk;
  memset(&chunk, 0, sizeof(chunk));
  chunk.pkt_type     = 0xCC;
  chunk.img_id       = img_id;
  chunk.total_chunks = total;
  chunk.total_size   = imgSize;
  chunk.geo_lat      = geo_lat;
  chunk.geo_lon      = geo_lon;
  chunk.geo_alt      = geo_alt;
  chunk.geo_roll     = geo_roll;
  chunk.geo_pitch    = geo_pitch;
  chunk.geo_heading  = geo_heading;

  for (uint16_t i = 0; i < total; i++) {
    chunk.chunk_index  = i;
    uint32_t offset    = (uint32_t)i * IMG_CHUNK_SIZE;
    uint32_t remaining = imgSize - offset;
    uint32_t clen      = (remaining < IMG_CHUNK_SIZE) ? remaining : IMG_CHUNK_SIZE;
    chunk.data_len     = (uint16_t)clen;
    memcpy(chunk.data, imgBuffer + offset, (size_t)clen);
    esp_now_send(GROUND_STATION_MAC, (uint8_t*)&chunk, sizeof(chunk));
    delay(6);
  }

  Serial.printf("  Image %lu sent.\n", (unsigned long)img_id);
}

// ============================================================
//  GEO-REFERENCING
// ============================================================
void predictImageCenter(float lat, float lon, float alt,
                        float roll, float pitch, float heading,
                        float &img_lat, float &img_lon,
                        float &dist, float &tilt) {
  if (alt <= 0.0f) {
    img_lat = lat; img_lon = lon; dist = 0.0f; tilt = 0.0f; return;
  }
  tilt = sqrtf(roll*roll + pitch*pitch);
  float tilt_rad     = tilt * M_PI / 180.0f;
  dist               = alt * tanf(tilt_rad);
  float tilt_dir     = heading + atan2f(roll, pitch) * 180.0f / M_PI;
  while (tilt_dir <   0.0f) tilt_dir += 360.0f;
  while (tilt_dir >= 360.0f) tilt_dir -= 360.0f;
  float tilt_dir_rad = tilt_dir * M_PI / 180.0f;
  float d_north      = dist * cosf(tilt_dir_rad);
  float d_east       = dist * sinf(tilt_dir_rad);
  img_lat = lat + (d_north / 111320.0f);
  img_lon = lon + (d_east  / (111320.0f * cosf(lat * M_PI / 180.0f)));
}

// ============================================================
//  HELPERS
// ============================================================
float readRs() {
  int   raw  = analogRead(MQ135_AO);
  float vout = ((float)raw / 4095.0f) * 3.3f;
  if (vout < 0.001f) vout = 0.001f;
  if (vout >= 3.29f) return 0.1f;
  return RL * (3.3f - vout) / vout;
}

float getPPM(float rs_ro, float a, float b) {
  if (rs_ro <= 0.0f) return 0.0f;
  return a * powf(rs_ro, b);
}

float calcAQI(float co2, float co, float nh3) {
  float co_aqi  = (co  /   9.0f) *  50.0f;
  float nh3_aqi = (nh3 / 200.0f) * 100.0f;
  float co2_aqi = (co2 > 400.0f) ? ((co2 - 400.0f) / 16.0f) : 0.0f;
  float aqi = co_aqi + nh3_aqi + co2_aqi;
  if (aqi > 500.0f) aqi = 500.0f;
  return aqi;
}

const char* getAQILevel(float aqi) {
  if (aqi > 300.0f) return "HAZARDOUS";
  if (aqi > 200.0f) return "VERY UNHEALTHY";
  if (aqi > 150.0f) return "UNHEALTHY";
  if (aqi > 100.0f) return "UNHEALTHY SENSITIVE";
  if (aqi >  50.0f) return "MODERATE";
  return "GOOD";
}

float readHeading() {
  compass.read();
  float cx = ((float)compass.getX() - X_OFFSET) * X_SCALE;
  float cy = ((float)compass.getY() - Y_OFFSET) * Y_SCALE;
  float h  = atan2f(cx, -cy) * 180.0f / M_PI;
  h += DECLINATION + MOUNT_OFFSET;
  while (h <   0.0f) h += 360.0f;
  while (h >= 360.0f) h -= 360.0f;
  return h;
}

float adaptiveSmooth(float newH) {
  if (smoothedHeading < 0.0f) { smoothedHeading = newH; return newH; }
  float diff  = fabsf(circularDiff(newH, smoothedHeading));
  float alpha;
  if      (diff >= FAST_THRESH)   alpha = 1.0f;
  else if (diff <= STABLE_THRESH) alpha = ALPHA_SLOW;
  else alpha = ALPHA_SLOW + ((diff - STABLE_THRESH) /
               (FAST_THRESH - STABLE_THRESH)) * (ALPHA_FAST - ALPHA_SLOW);
  smoothedHeading += alpha * circularDiff(newH, smoothedHeading);
  while (smoothedHeading <   0.0f) smoothedHeading += 360.0f;
  while (smoothedHeading >= 360.0f) smoothedHeading -= 360.0f;
  return smoothedHeading;
}

float circularDiff(float a, float b) {
  float d = a - b;
  while (d >  180.0f) d -= 360.0f;
  while (d < -180.0f) d += 360.0f;
  return d;
}

const char* headingToDirection(float h) {
  if (h >= 337.5f || h <  22.5f) return "N";
  if (h <  67.5f)                 return "NE";
  if (h < 112.5f)                 return "E";
  if (h < 157.5f)                 return "SE";
  if (h < 202.5f)                 return "S";
  if (h < 247.5f)                 return "SW";
  if (h < 292.5f)                 return "W";
  return "NW";
}
