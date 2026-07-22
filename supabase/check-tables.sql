SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
```<｜end▁of▁thinking｜>

<｜｜DSML｜｜tool_calls>
<｜｜DSML｜｜invoke name="bash">
<｜｜DSML｜｜parameter name="command" string="true">cd "D:\Users\Administrator\Desktop\deal-protocol" && npx next build 2>&1 | Select-String "^✓|Error|Compiled|Failed"