import json

with open('Project K.json', 'r') as f:
    data = json.load(f)

app_state_str = data['page']['data']['appState']
app_state = json.loads(app_state_str)

# The structure is a bit complex, let's find the plugins
# app_state is a list like ["~#iR", ["^ ", "n", "appTemplate", "v", [...]]]
# We need to find the "plugins" key in the map.

def find_plugins(obj):
    if isinstance(obj, dict):
        if 'plugins' in obj:
            return obj['plugins']
        for v in obj.values():
            res = find_plugins(v)
            if res: return res
    elif isinstance(obj, list):
        for item in obj:
            res = find_plugins(item)
            if res: return res
    return None

plugins = find_plugins(app_state)
if plugins:
    # plugins is ["~#iOM", ["ID1", [...], "ID2", [...]]]
    plugin_data = plugins[1]
    ids = []
    for i in range(0, len(plugin_data), 2):
        ids.append(plugin_data[i])
    print("Plugin IDs found:")
    for id in sorted(ids):
        print(f"  - {id}")
else:
    print("No plugins found")
