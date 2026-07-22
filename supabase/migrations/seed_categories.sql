-- M03: 四品类种子配置
-- 在 Supabase SQL Editor 中运行，在 001_schema.sql 之后

-- 家政
INSERT INTO category_configs (category, risk_tier, schema_json, entry_requirements, response_mode, safety_requirements, enabled, version)
VALUES (
  '家政',
  'low',
  '{
    "core_fields": {
      "location": {"type": "geo", "required": true},
      "time_window": {"type": "string", "required": true},
      "budget_range": {"type": "int_array", "required": true},
      "urgency": {"type": "enum", "required": true, "options": ["normal","urgent","scheduled"]}
    },
    "category_fields": {
      "service_type": {"type": "enum", "required": true, "options": ["下水道疏通","空调清洗","全屋清洁","水电维修","开锁换锁","搬家搬运","其他"]},
      "property_type": {"type": "enum", "required": true, "options": ["住宅","公寓","商业","其他"]},
      "estimated_duration_min": {"type": "int", "required": true}
    }
  }',
  '{"identity_verified": true, "manual_review": false}',
  'grab_first',
  '{"full_gps_trail": false, "enhanced_identity": false}',
  true,
  1
);

-- 交友
INSERT INTO category_configs (category, risk_tier, schema_json, entry_requirements, response_mode, safety_requirements, enabled, version)
VALUES (
  '交友',
  'medium',
  '{
    "core_fields": {
      "location": {"type": "geo", "required": true},
      "time_window": {"type": "string", "required": true},
      "budget_range": {"type": "int_array", "required": false},
      "urgency": {"type": "enum", "required": true, "options": ["today","scheduled"]}
    },
    "category_fields": {
      "group_size": {"type": "int", "required": true},
      "age_range": {"type": "int_array", "required": false},
      "gender_preference": {"type": "enum", "required": false, "options": ["male","female","any"]},
      "scene": {"type": "string", "required": true}
    }
  }',
  '{"identity_verified": true, "manual_review": false}',
  'interest_list',
  '{"full_gps_trail": false, "enhanced_identity": false}',
  true,
  1
);

-- 按摩（阶段二开放，enabled=false）
INSERT INTO category_configs (category, risk_tier, schema_json, entry_requirements, response_mode, safety_requirements, enabled, version)
VALUES (
  '按摩',
  'high',
  '{
    "core_fields": {
      "location": {"type": "geo", "required": true},
      "time_window": {"type": "string", "required": true},
      "budget_range": {"type": "int_array", "required": true}
    },
    "category_fields": {
      "service_item": {"type": "enum", "required": true, "options": ["推拿","足疗","精油","全身","其他"]},
      "duration_min": {"type": "int", "required": true},
      "on_site_or_shop": {"type": "enum", "required": true, "options": ["on_site","shop"]},
      "gender_preference": {"type": "enum", "required": false, "options": ["male","female","any"]}
    }
  }',
  '{"identity_verified": true, "qualification": ["职业资格证","健康证"], "manual_review": true}',
  'grab_first',
  '{"full_gps_trail": true, "enhanced_identity": true}',
  false,
  1
);

-- 医疗陪护（阶段三开放，enabled=false）
INSERT INTO category_configs (category, risk_tier, schema_json, entry_requirements, response_mode, safety_requirements, enabled, version)
VALUES (
  '医疗陪护',
  'high',
  '{
    "core_fields": {
      "location": {"type": "geo", "required": true},
      "time_window": {"type": "string", "required": true}
    },
    "category_fields": {
      "care_type": {"type": "enum", "required": true, "options": ["陪同就医","代为排队挂号","住院陪护","康复陪同","其他"]},
      "care_recipient_condition": {"type": "string", "required": true},
      "id_type": {"type": "enum", "required": true, "options": ["身份证","社保卡","其他"]}
    }
  }',
  '{"identity_verified": true, "qualification": ["陪护证","健康证"], "manual_review": true}',
  'agency_dispatch',
  '{"full_gps_trail": true, "enhanced_identity": true}',
  false,
  1
);
