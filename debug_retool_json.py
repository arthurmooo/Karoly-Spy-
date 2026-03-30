import json

with open('Project K.json', 'r') as f:
    data = json.load(f)

app_state_str = data['page']['data']['appState']
# Retool JSON is Transit encoded. 
# It's basically a list where some elements are special markers.

print(f"Length of appState string: {len(app_state_str)}")

# Let's just find the "plugins" substring and see what's around it.
idx = app_state_str.find('"plugins"')
if idx != -1:
    print("Found 'plugins' at index:", idx)
    print("Context:", app_state_str[idx:idx+200])
else:
    print("'plugins' not found in appState string")
