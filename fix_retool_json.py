import json

with open('Project K.json', 'r') as f:
    json_data = f.read()

# The pattern to find in the raw string (it's escaped in the JSON)
old_ref = "inp_sport.value === 'Run' ? transformer_pace_to_ms.value : inp_cp.value"

# New logic: parse inp_pace.value (e.g. "03:16" or "03'16") to m/s
# 1000 / (min * 60 + sec)
new_logic = "(inp_sport.value === 'Run' ? ((() => { const p = (inp_pace.value || '').split(/[:']/); return p.length === 2 ? (1000 / (parseInt(p[0]) * 60 + parseInt(p[1]))) : parseFloat(inp_pace.value); })()) : inp_cp.value)"

if old_ref in json_data:
    new_json_data = json_data.replace(old_ref, new_logic)
    with open('Project K.json', 'w') as f:
        f.write(new_json_data)
    print("Successfully replaced the broken reference in Project K.json")
else:
    print("Could not find the old reference in the JSON file.")
