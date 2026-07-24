-- P0-02: Bandit 物理隔离 — 数据库角色级权限隔离
-- 实现《设计方案.md》§4.4: bandit_reader 角色从数据库层面禁止读取信用数据
-- 即使 Bandit 代码出现 bug，也无法从数据库层面读取信用记录

-- 1. 创建 bandit_reader 角色（若不存在）
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'bandit_reader') THEN
    CREATE ROLE bandit_reader NOLOGIN;
  END IF;
END $$;

-- 2. 物理隔离：剥夺 Bandit 角色对信用敏感表的读取权限
REVOKE ALL ON public.credit_records FROM bandit_reader;
REVOKE ALL ON public.credit_events FROM bandit_reader;

-- 3. 仅授予订单与协议表的只读权限（Bandit 排序所需的最小信息）
GRANT SELECT ON public.orders TO bandit_reader;
GRANT SELECT ON public.protocols TO bandit_reader;

-- 4. 验证：bandit_reader 执行 SELECT * FROM credit_records 应报权限错误
-- （验证脚本见 tests/p0-deviations.test.ts）
