class AddDashboardThemeToWorkspaces < ActiveRecord::Migration[8.1]
  def change
    add_column :workspaces, :dashboard_theme, :string
  end
end
