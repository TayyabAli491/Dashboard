// ============================================================
//  ESP32-WROOM - GROUND STATION (Full CanSat Integration)
//
//  Receives:
//    1) SensorPacket  - telemetry from ESP32-S3
//    2) ImageChunk    - JPEG chunks (pkt_type = 0xCC)
//
//  LED & Buzzer pins:
//    GPIO 25 -> RED LED     GPIO 26 -> YELLOW LED
//    GPIO 27 -> GREEN LED   GPIO 33 -> Buzzer
//
//  Serial compatibility:
//    Emits "TELEM_JSON:<json>" for each sensor packet so
//    script/serial_telemetry_bridge.py continues to work.
// ============================================================
#include <WiFi.h>
#include <esp_now.h>
#include <esp_wifi.h>

// -- Pins -----------------------------------------------------
#define LED_RED               25
#define LED_YELLOW            26
#define LED_GREEN             27
#define BUZZER                33
#define RSSI_WEAK_THRESHOLD  -80
#define NO_PACKET_TIMEOUT_MS  5000UL

// Keep serial bridge output stable for the dashboard script.
#define SERIAL_BRIDGE_OUTPUT  1

// -- Sensor packet (must match ESP32-S3 exactly) -------------
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

// -- Image chunk packet (must match ESP32-S3 exactly) --------
#define IMG_CHUNK_SIZE  200U
#define MAX_IMG_SIZE    51200U

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

// -- Image reassembly ----------------------------------------
uint8_t  imgBuf[MAX_IMG_SIZE];
bool     gotChunk[256];
uint32_t curImgId      = 0;
uint16_t chunksExpect  = 0;
uint16_t chunksGot     = 0;
uint32_t totalImgsDone = 0;

// -- Status flags --------------------------------------------
bool          firstPacketReceived = false;
bool          packetActiveFlag    = false;
int8_t        lastRSSI            = 0;
unsigned long lastPacketTime      = 0;
uint32_t      lastSensorPacketID  = 0;

// ============================================================
//  Serial JSON helper (for serial_telemetry_bridge.py)
// ============================================================
static int buildDashboardJson(const SensorPacket &p, char *out, size_t outLen) {
  return snprintf(
      out, outLen,
      "{"
      "\"roll\":%.5f,\"pitch\":%.5f,\"yaw\":%.5f,"
      "\"ax\":%.5f,\"ay\":%.5f,\"az\":%.5f,"
      "\"gx\":%.5f,\"gy\":%.5f,\"gz\":%.5f,"
      "\"accel_mag\":%.5f,"
      "\"heading\":%.5f,"
      "\"direction\":\"%.3s\","
      "\"temperature\":%.5f,\"pressure\":%.5f,"
      "\"bmp_altitude\":%.5f,"
      "\"altitude\":%.5f,"
      "\"latitude\":%.7f,\"longitude\":%.7f,"
      "\"gps_altitude\":%.5f,"
      "\"speed_kmh\":%.5f,\"course\":%.5f,"
      "\"satellites\":%d,"
      "\"gps_valid\":%s,"
      "\"gps_hour\":%d,\"gps_min\":%d,\"gps_sec\":%d,"
      "\"gps_day\":%d,\"gps_month\":%d,\"gps_year\":%d,"
      "\"co2_ppm\":%.5f,\"nh3_ppm\":%.5f,\"co_ppm\":%.5f,"
      "\"alcohol_ppm\":%.5f,\"benzene_ppm\":%.5f,"
      "\"aqi_index\":%.5f,\"aqi_level\":\"%.23s\","
      "\"mq135\":%.5f,\"gas\":%.5f,"
      "\"img_center_lat\":%.7f,\"img_center_lon\":%.7f,"
      "\"img_ground_dist\":%.5f,\"img_tilt_angle\":%.5f,"
      "\"img_captured\":%s,\"img_id\":%lu,"
      "\"packetID\":%lu,\"timestamp_ms\":%lu"
      "}",
      p.roll, p.pitch, p.yaw,
      p.ax, p.ay, p.az,
      p.gx, p.gy, p.gz,
      p.accel_mag,
      p.heading,
      p.direction,
      p.temperature, p.pressure,
      p.bmp_altitude,
      p.bmp_altitude,
      p.latitude, p.longitude,
      p.gps_altitude,
      p.speed_kmh, p.course,
      p.satellites,
      p.gps_valid ? "true" : "false",
      p.gps_hour, p.gps_min, p.gps_sec,
      p.gps_day, p.gps_month, p.gps_year,
      p.co2_ppm, p.nh3_ppm, p.co_ppm,
      p.alcohol_ppm, p.benzene_ppm,
      p.aqi_index, p.aqi_level,
      p.aqi_index, p.aqi_index,
      p.img_center_lat, p.img_center_lon,
      p.img_ground_dist, p.img_tilt_angle,
      p.img_captured ? "true" : "false",
      (unsigned long)p.img_id,
      (unsigned long)p.packetID,
      (unsigned long)p.timestamp_ms);
}

static void emitSerialTelemetry(const SensorPacket &p) {
#if SERIAL_BRIDGE_OUTPUT
  char buf[3072];
  int n = buildDashboardJson(p, buf, sizeof(buf));
  if (n > 0 && (size_t)n < sizeof(buf)) {
    Serial.print("TELEM_JSON:");
    Serial.println(buf);
  }
#else
  (void)p;
#endif
}

// ============================================================
//  LED helpers
// ============================================================
void ledsOff() {
  digitalWrite(LED_RED,    LOW);
  digitalWrite(LED_YELLOW, LOW);
  digitalWrite(LED_GREEN,  LOW);
}

void setLed(uint8_t pin) {
  ledsOff();
  digitalWrite(pin, HIGH);
}

void startupLedSequence() {
  ledsOff();
  digitalWrite(LED_RED,    HIGH); delay(200); digitalWrite(LED_RED,    LOW); delay(100);
  digitalWrite(LED_YELLOW, HIGH); delay(200); digitalWrite(LED_YELLOW, LOW); delay(100);
  digitalWrite(LED_GREEN,  HIGH); delay(200); digitalWrite(LED_GREEN,  LOW); delay(100);
}

// ============================================================
//  Buzzer helpers
// ============================================================
void beep(uint16_t ms) {
  digitalWrite(BUZZER, HIGH); delay(ms); digitalWrite(BUZZER, LOW);
}

void doubleBeep() {
  beep(80); delay(80); beep(80);
}

// ============================================================
//  Progress bar
// ============================================================
void printProgress(uint16_t got, uint16_t total) {
  int pct    = total > 0 ? (int)((float)got / total * 100) : 0;
  int filled = pct / 5;
  Serial.print("  [");
  for (int i = 0; i < 20; i++) Serial.print(i < filled ? "#" : ".");
  Serial.printf("] %3d%%  (%u/%u)\n", pct, got, total);
}

// ============================================================
//  Handle SENSOR PACKET
// ============================================================
void handleSensorPacket(const uint8_t *data, int len) {
  if (len != (int)sizeof(SensorPacket)) {
    Serial.printf("[?] SensorPacket size mismatch: got %d expected %d\n",
      len, (int)sizeof(SensorPacket));
    return;
  }

  SensorPacket p;
  memcpy(&p, data, sizeof(p));
  lastSensorPacketID = p.packetID;

  // Keep bridge-compatible telemetry stream available to host PC.
  emitSerialTelemetry(p);

  Serial.println("\n+-----------------------------------------+");
  Serial.printf( "|  TELEMETRY  PKT #%lu  T+%lums\n",
    (unsigned long)p.packetID, (unsigned long)p.timestamp_ms);
  Serial.println("+-----------------------------------------+");

  Serial.printf("|  Roll:%+6.1f  Pitch:%+6.1f  Yaw:%+6.1f\n",
    p.roll, p.pitch, p.yaw);
  Serial.printf("|  Accel: ax=%.3f ay=%.3f az=%.3f |a|=%.3fg\n",
    p.ax, p.ay, p.az, p.accel_mag);
  Serial.printf("|  Gyro:  gx=%.2f gy=%.2f gz=%.2f\n",
    p.gx, p.gy, p.gz);
  Serial.printf("|  Heading: %.1f (%s)\n", p.heading, p.direction);
  Serial.printf("|  Temp: %.1fC  Press: %.1f hPa  Alt: %.1f m\n",
    p.temperature, p.pressure, p.bmp_altitude);

  if (p.gps_valid) {
    Serial.printf("|  GPS: %.6f, %.6f  Alt:%.1fm  Spd:%.1fkm/h\n",
      p.latitude, p.longitude, p.gps_altitude, p.speed_kmh);
    Serial.printf("|  Sats:%d  Time:%02d:%02d:%02d  Date:%02d/%02d/%d\n",
      p.satellites,
      p.gps_hour, p.gps_min, p.gps_sec,
      p.gps_day,  p.gps_month, p.gps_year);
    Serial.printf("|  Maps: https://maps.google.com/?q=%.6f,%.6f\n",
      p.latitude, p.longitude);
  } else {
    Serial.println("|  GPS: no fix");
  }

  Serial.printf("|  CO2:%.1f  CO:%.1f  NH3:%.1f  Alcohol:%.1f  Benzene:%.1f\n",
    p.co2_ppm, p.co_ppm, p.nh3_ppm, p.alcohol_ppm, p.benzene_ppm);
  Serial.printf("|  AQI: %.1f  [%s]\n", p.aqi_index, p.aqi_level);

  if (p.img_captured) {
    Serial.printf("|  IMAGE #%lu captured!\n", (unsigned long)p.img_id);
    Serial.printf("|  Center: %.6f, %.6f\n", p.img_center_lat, p.img_center_lon);
    Serial.printf("|  Tilt: %.1f  Offset: %.1f m\n", p.img_tilt_angle, p.img_ground_dist);
    Serial.printf("|  Maps: https://maps.google.com/?q=%.6f,%.6f\n",
      p.img_center_lat, p.img_center_lon);
  }

  Serial.printf("|  RSSI: %d dBm\n", (int)lastRSSI);
  Serial.println("+-----------------------------------------+");
}

// ============================================================
//  Handle IMAGE CHUNK
// ============================================================
void handleImageChunk(const uint8_t *data, int len) {
  if (len != (int)sizeof(ImageChunk)) {
    Serial.printf("[?] ImageChunk size mismatch: got %d expected %d\n",
      len, (int)sizeof(ImageChunk));
    return;
  }

  ImageChunk c;
  memcpy(&c, data, sizeof(c));

  if (c.img_id != curImgId) {
    curImgId     = c.img_id;
    chunksExpect = c.total_chunks;
    chunksGot    = 0;
    memset(gotChunk, 0, sizeof(gotChunk));
    Serial.printf("\n>>> Image #%lu starting - %u chunks / %lu bytes\n",
      (unsigned long)c.img_id,
      (unsigned int)c.total_chunks,
      (unsigned long)c.total_size);
    Serial.printf("    Geo: %.6f, %.6f  Alt:%.1fm  Tilt:R%.1f P%.1f H%.1f\n",
      c.geo_lat, c.geo_lon, c.geo_alt,
      c.geo_roll, c.geo_pitch, c.geo_heading);
  }

  uint16_t idx = c.chunk_index;
  if (idx < 256 && !gotChunk[idx]) {
    uint32_t offset = (uint32_t)idx * IMG_CHUNK_SIZE;
    if (offset + c.data_len <= MAX_IMG_SIZE) {
      memcpy(imgBuf + offset, c.data, c.data_len);
      gotChunk[idx] = true;
      chunksGot++;
    }
  }

  if (chunksGot % 10 == 0 || chunksGot == chunksExpect) {
    printProgress(chunksGot, chunksExpect);
  }

  if (chunksGot == chunksExpect && chunksExpect > 0) {
    totalImgsDone++;
    uint32_t lastBytes = c.data_len;
    uint32_t imgBytes  = (uint32_t)(chunksExpect - 1) * IMG_CHUNK_SIZE + lastBytes;

    Serial.println("\n==============================================");
    Serial.printf( " IMAGE #%lu COMPLETE\n", (unsigned long)curImgId);
    Serial.printf( " Size    : %lu bytes\n", (unsigned long)imgBytes);
    Serial.printf( " Total   : %lu images\n", (unsigned long)totalImgsDone);
    Serial.printf( " RSSI    : %d dBm\n", (int)lastRSSI);
    Serial.printf( " Geo     : %.6f, %.6f\n", c.geo_lat, c.geo_lon);
    Serial.printf( " Alt     : %.1f m\n", c.geo_alt);
    Serial.printf( " Maps    : https://maps.google.com/?q=%.6f,%.6f\n", c.geo_lat, c.geo_lon);

    if (imgBytes >= 3 && imgBuf[0] == 0xFF && imgBuf[1] == 0xD8 && imgBuf[2] == 0xFF) {
      Serial.println(" JPEG    : VALID header (FF D8 FF)");
    } else {
      Serial.printf(" JPEG    : BAD header [%02X %02X %02X]\n", imgBuf[0], imgBuf[1], imgBuf[2]);
    }

    if (imgBytes >= 2 && imgBuf[imgBytes - 2] == 0xFF && imgBuf[imgBytes - 1] == 0xD9) {
      Serial.println(" JPEG    : VALID footer (FF D9)");
    } else {
      Serial.println(" JPEG    : footer missing");
    }
    Serial.println("==============================================\n");

    doubleBeep();
  }
}

// ============================================================
//  ESP-NOW RECEIVE CALLBACK
// ============================================================
static void handleIncomingPacket(const uint8_t *data, int len) {
  wifi_ap_record_t ap;
  if (esp_wifi_sta_get_ap_info(&ap) == ESP_OK) {
    lastRSSI = ap.rssi;
  }

  lastPacketTime   = millis();
  packetActiveFlag = true;

  if (len < 1) return;

  if (data[0] == 0xCC) {
    handleImageChunk(data, len);
  } else {
    handleSensorPacket(data, len);
  }
}

// Arduino-ESP32 3.x uses esp_now_recv_info_t; 2.x uses mac,data,len.
#ifndef ESP_ARDUINO_VERSION
#define ESP_ARDUINO_VERSION 0
#endif
#if ESP_ARDUINO_VERSION >= 0x30000
void onReceive(const esp_now_recv_info_t *info, const uint8_t *data, int len) {
  (void)info;
  handleIncomingPacket(data, len);
}
#else
void onReceive(const uint8_t *mac, const uint8_t *data, int len) {
  (void)mac;
  handleIncomingPacket(data, len);
}
#endif

// ============================================================
//  SETUP
// ============================================================
void setup() {
  Serial.begin(115200);
  delay(300);

  pinMode(LED_RED,    OUTPUT);
  pinMode(LED_YELLOW, OUTPUT);
  pinMode(LED_GREEN,  OUTPUT);
  pinMode(BUZZER,     OUTPUT);
  ledsOff();
  digitalWrite(BUZZER, LOW);

  startupLedSequence();
  delay(100);
  beep(100);
  delay(100);
  setLed(LED_RED);

  Serial.println("\n=== Ground Station - Full CanSat Integration ===");

  uint8_t mac[6];
  esp_wifi_get_mac(WIFI_IF_STA, mac);
  Serial.printf("Ground STA MAC: %02X:%02X:%02X:%02X:%02X:%02X\n",
                mac[0], mac[1], mac[2], mac[3], mac[4], mac[5]);

  WiFi.mode(WIFI_STA);
  WiFi.disconnect();
  delay(100);

  if (esp_now_init() != ESP_OK) {
    Serial.println("ESP-NOW init FAILED");
    while (1) {
      digitalWrite(LED_RED, HIGH); delay(100);
      digitalWrite(LED_RED, LOW);  delay(100);
    }
  }
  esp_now_register_recv_cb(onReceive);

  Serial.printf("SensorPacket size : %d bytes\n", (int)sizeof(SensorPacket));
  Serial.printf("ImageChunk   size : %d bytes\n", (int)sizeof(ImageChunk));
  Serial.println("RED    = waiting for packets");
  Serial.println("GREEN  = receiving (good signal)");
  Serial.println("YELLOW = weak signal (RSSI < -80 dBm)");
  Serial.println("Waiting...\n");
}

// ============================================================
//  LOOP
// ============================================================
void loop() {
  unsigned long now = millis();

  if (packetActiveFlag && !firstPacketReceived) {
    firstPacketReceived = true;
    beep(100);
    Serial.println("[BEEP] First packet received!");
  }

  if (packetActiveFlag) {
    packetActiveFlag = false;
    if (lastRSSI < RSSI_WEAK_THRESHOLD) {
      setLed(LED_YELLOW);
      Serial.printf("[LED] YELLOW - weak signal RSSI: %d dBm\n", (int)lastRSSI);
    } else {
      setLed(LED_GREEN);
    }
  }

  if (firstPacketReceived && (now - lastPacketTime > NO_PACKET_TIMEOUT_MS)) {
    static unsigned long lastRedTime = 0;
    if (now - lastRedTime > NO_PACKET_TIMEOUT_MS) {
      setLed(LED_RED);
      lastRedTime = now;
      Serial.println("[LED] RED - no packet for 5s");
    }
  }

  delay(10);
}
