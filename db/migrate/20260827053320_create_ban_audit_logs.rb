class CreateBanAuditLogs < ActiveRecord::Migration[7.2]
  def change
    create_table :ban_audit_logs do |t|
      t.references :user, null: false, foreign_key: true
      t.integer :action, null: false
      t.integer :books_affected, null: false, default: 0
      t.jsonb :impact_details, null: false, default: {}
      t.string :performed_by

      t.timestamps
    end

    add_index :ban_audit_logs, :action
  end
end
