import json

with open('Project K.json', 'r') as f:
    data = json.load(f)

app_state_str = data['page']['data']['appState']
app_state = json.loads(app_state_str)

# app_state is ["~#iR", ["^ ", "n", "appTemplate", "v", ["^ ", ...]]]
# The second element is a list starting with "^ " which represents a map in Transit.
# ["^ ", "key1", "val1", "key2", "val2", ...]

def get_transit_map(l):
    if not isinstance(l, list) or len(l) < 1 or l[0] != "^ ":
        return None
    d = {}
    for i in range(1, len(l), 2):
        d[l[i]] = l[i+1]
    return d

def get_transit_omap(l):
    if not isinstance(l, list) or len(l) < 1 or l[0] != "~#iOM":
        return None
    # omap is ["~#iOM", ["key1", val1, "key2", val2, ...]]
    data = l[1]
    d = {}
    for i in range(0, len(data), 2):
        d[data[i]] = data[i+1]
    return d

app_template_map = get_transit_map(app_state[1])
v_map = get_transit_map(app_template_map['v'])
plugins_omap = get_transit_omap(v_map['plugins'])

if plugins_omap:
    print("Plugin IDs found:")
    for pid in sorted(plugins_omap.keys()):
        print(f"  - {pid}")
else:
    print("No plugins found")
