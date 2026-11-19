import {MigrationInterface,QueryRunner} from 'typeorm';
export const tables:Record<string,string>={
 users:"id INT PRIMARY KEY AUTO_INCREMENT, email VARCHAR(255) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL, role VARCHAR(16) NOT NULL DEFAULT 'admin'",
 properties:"id INT PRIMARY KEY AUTO_INCREMENT, name VARCHAR(120) NOT NULL, timezone VARCHAR(64) NOT NULL DEFAULT 'Europe/Budapest', currency CHAR(3) NOT NULL DEFAULT 'HUF', reading_day TINYINT NOT NULL DEFAULT 1",
 property_access:"user_id INT NOT NULL REFERENCES users(id), property_id INT NOT NULL REFERENCES properties(id), PRIMARY KEY(user_id,property_id)",
 sessions:"token CHAR(64) PRIMARY KEY, user_id INT NOT NULL REFERENCES users(id), expires_at DATETIME NOT NULL, INDEX(expires_at)",
 residents:"id INT PRIMARY KEY AUTO_INCREMENT, property_id INT NOT NULL REFERENCES properties(id), name VARCHAR(100) NOT NULL, active_from CHAR(7) NOT NULL, active_to CHAR(7), weight INT NOT NULL DEFAULT 1",
 meters:"id INT PRIMARY KEY AUTO_INCREMENT, property_id INT NOT NULL REFERENCES properties(id), code VARCHAR(32) NOT NULL, label VARCHAR(80) NOT NULL, unit VARCHAR(8) NOT NULL, billing_role VARCHAR(16) NOT NULL, UNIQUE(property_id,code)",
 tariff_versions:"id INT PRIMARY KEY AUTO_INCREMENT, meter_id INT NOT NULL REFERENCES meters(id), valid_from CHAR(7) NOT NULL, valid_to CHAR(7), rules_json JSON NOT NULL, UNIQUE(meter_id,valid_from)",
 recurring_charges:"id INT PRIMARY KEY AUTO_INCREMENT, property_id INT NOT NULL REFERENCES properties(id), label VARCHAR(100) NOT NULL, category VARCHAR(16) NOT NULL, amount INT NOT NULL, valid_from CHAR(7) NOT NULL, valid_to CHAR(7), allocation_rule JSON NOT NULL",
 billing_periods:"id INT PRIMARY KEY AUTO_INCREMENT, property_id INT NOT NULL REFERENCES properties(id), period_key CHAR(7) NOT NULL, status VARCHAR(16) NOT NULL, version INT NOT NULL, finalized_at DATETIME, input_json JSON NOT NULL, result_json JSON NOT NULL, UNIQUE(property_id,period_key)",
 meter_readings:"meter_id INT NOT NULL REFERENCES meters(id), period_id INT NOT NULL REFERENCES billing_periods(id) ON DELETE CASCADE, reading_date DATE, previous_value DECIMAL(16,4), current_value DECIMAL(16,4), consumption DECIMAL(16,4), PRIMARY KEY(meter_id,period_id)",
 billing_items:"id INT PRIMARY KEY AUTO_INCREMENT, period_id INT NOT NULL REFERENCES billing_periods(id) ON DELETE CASCADE, category VARCHAR(16) NOT NULL, label VARCHAR(160) NOT NULL, amount INT NOT NULL, origin VARCHAR(16) NOT NULL, snapshot JSON NOT NULL",
 resident_allocations:"billing_item_id INT NOT NULL REFERENCES billing_items(id) ON DELETE CASCADE, resident_id INT NOT NULL REFERENCES residents(id), amount INT NOT NULL, PRIMARY KEY(billing_item_id,resident_id)",
 import_batches:"id INT PRIMARY KEY AUTO_INCREMENT, property_id INT NOT NULL REFERENCES properties(id), source_filename VARCHAR(255) NOT NULL, status VARCHAR(16) NOT NULL, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, mapping_json JSON NOT NULL",
 import_rows:"id INT PRIMARY KEY AUTO_INCREMENT, batch_id INT NOT NULL REFERENCES import_batches(id), period_key CHAR(7) NOT NULL, period_id INT, original_json JSON NOT NULL, parsed_json JSON NOT NULL",
 audit_logs:"id INT PRIMARY KEY AUTO_INCREMENT, property_id INT NOT NULL REFERENCES properties(id), actor_id INT NOT NULL REFERENCES users(id), entity_key VARCHAR(100) NOT NULL, action VARCHAR(32) NOT NULL, before_json JSON, after_json JSON, created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX(property_id,entity_key)"
};
// MySQL 8.4 requires separate FOREIGN KEY clauses for these references.
function ddl(def:string){const keys:string[]=[];const fields=def.replace(/(\w+) (INT NOT NULL) REFERENCES (\w+)\(id\)( ON DELETE CASCADE)?/g,(_,field,type,parent,cascade)=>{keys.push('FOREIGN KEY ('+field+') REFERENCES '+parent+'(id)'+(cascade||''));return field+' '+type;});return [fields,...keys].join(', ');}
export class Initial1795000000000 implements MigrationInterface{
 async up(q:QueryRunner){for(const [name,def] of Object.entries(tables))await q.query('CREATE TABLE '+name+' ('+ddl(def)+') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');}
 async down(q:QueryRunner){for(const name of Object.keys(tables).reverse())await q.query('DROP TABLE '+name);}
}

