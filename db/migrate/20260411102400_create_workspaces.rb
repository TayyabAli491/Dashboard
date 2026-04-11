class CreateWorkspaces < ActiveRecord::Migration[8.1]
  def change
    create_table :workspaces do |t|
      t.references :user, null: false, foreign_key: true, index: true
      t.string :name, null: false
      t.text :description
      t.string :api_key, null: false
      t.boolean :is_public, null: false, default: false

      t.timestamps
    end

    add_index :workspaces, :api_key, unique: true
  end
end
