Rails.application.routes.draw do
  get "up" => "rails/health#show", as: :rails_health_check

  mount ActionCable.server => "/cable"

  devise_for :users, controllers: {
    sessions: "users/sessions",
    registrations: "users/registrations"
  }

  authenticated :user do
    root to: "workspaces#index", as: :authenticated_root
  end

  unauthenticated do
    root to: redirect("/users/sign_in"), as: :unauthenticated_root
  end

  resources :workspaces do
    member do
      get :setup
      patch :save_layout
      get :live_dashboard
      post :send_test_telemetry
    end
    resource :payload_schema, only: %i[show new create edit update]
    resources :telemetry_records, only: %i[index show]
    resources :sessions, shallow: true do
      resources :telemetry_records, only: %i[index show], shallow: true
    end
  end

  namespace :api, defaults: { format: :json } do
    resources :workspaces, only: [] do
      member do
        post :telemetry
        post :images
      end
    end
  end
end
