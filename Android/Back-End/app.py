"""
PokéroleDex 3.0 - Server Android & Mobile Edition
Serves the Pokérole companion app, REST API, mobile PWA manifest, and static assets.
Configured for local Wi-Fi phone access (0.0.0.0) with auto LAN IP discovery.
"""

import os
import sys
import json
import sqlite3
import socket
import webbrowser
from threading import Timer

# Self-bootstrap check for required dependencies
try:
    from flask import Flask, jsonify, request, render_template, send_from_directory
except ImportError:
    print("=" * 60)
    print("Libreria 'Flask' mancante. Installazione automatica in corso...")
    print("=" * 60)
    import subprocess
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "flask>=3.0.0"])
        from flask import Flask, jsonify, request, render_template, send_from_directory
        print("Flask installato con successo!")
    except Exception as e:
        print(f"Errore durante l'installazione automatica di Flask: {e}")
        print("Installa manualmente con: pip install -r requirements.txt")
        sys.exit(1)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "DB", "pokeroledex.sqlite")
STORAGE_DIR = os.path.join(BASE_DIR, "Storage")
IMAGES_DIR = os.path.join(STORAGE_DIR, "images")

# Translation normalization dictionaries for API query parameters
PARAM_TYPE_MAP = {
    'normal': 'Normale', 'fire': 'Fuoco', 'water': 'Acqua', 'grass': 'Erba',
    'electric': 'Elettro', 'ice': 'Ghiaccio', 'fighting': 'Lotta', 'poison': 'Veleno',
    'ground': 'Terra', 'flying': 'Volante', 'psychic': 'Psico', 'bug': 'Coleottero',
    'rock': 'Roccia', 'ghost': 'Spettro', 'dragon': 'Drago', 'steel': 'Acciaio',
    'dark': 'Buio', 'fairy': 'Folletto',
    'normale': 'Normale', 'fuoco': 'Fuoco', 'acqua': 'Acqua', 'erba': 'Erba',
    'elettro': 'Elettro', 'ghiaccio': 'Ghiaccio', 'lotta': 'Lotta', 'veleno': 'Veleno',
    'terra': 'Terra', 'volante': 'Volante', 'psico': 'Psico', 'coleottero': 'Coleottero',
    'roccia': 'Roccia', 'spettro': 'Spettro', 'drago': 'Drago', 'acciaio': 'Acciaio',
    'buio': 'Buio', 'folletto': 'Folletto'
}

PARAM_RANK_MAP = {
    'starter': 'Principiante', 'principiante': 'Principiante',
    'rookie': 'Novizio', 'novizio': 'Novizio',
    'standard': 'Standard',
    'advanced': 'Avanzato', 'avanzato': 'Avanzato',
    'expert': 'Esperto', 'esperto': 'Esperto',
    'ace': 'Asso', 'asso': 'Asso',
    'master': 'Maestro', 'maestro': 'Maestro',
    'champion': 'Campione', 'campione': 'Campione'
}

PARAM_CAT_MAP = {
    'physical': 'Fisico', 'fisico': 'Fisico',
    'special': 'Speciale', 'speciale': 'Speciale',
    'support': 'Supporto', 'supporto': 'Supporto'
}

PARAM_POCKET_MAP = {
    'helditems': 'Strumenti Tenuti', 'strumenti tenuti': 'Strumenti Tenuti',
    'traineritems': 'Strumenti Allenatore', 'strumenti allenatore': 'Strumenti Allenatore',
    'evolutionitem': 'Strumenti Evolutivi', 'strumenti evolutivi': 'Strumenti Evolutivi',
    'medicine': 'Medicine',
    'pokeballs': 'Poké Ball', 'poké ball': 'Poké Ball',
    'technicalmachine': 'Macchine Tecniche (MT)'
}

def get_lan_ip():
    """Detects the real LAN/Wi-Fi IPv4 address of the computer to connect phones easily."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.5)
        # 8.8.8.8 connect doesn't send packets, but lets the OS select the primary outgoing network interface
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

def ensure_database():
    """Ensures tables for trainer characters and custom Pokemon exist."""
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("""
    CREATE TABLE IF NOT EXISTS trainers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        age INTEGER DEFAULT 14,
        concept TEXT,
        nature TEXT,
        rank TEXT DEFAULT 'Principiante',
        strength INTEGER DEFAULT 1,
        dexterity INTEGER DEFAULT 1,
        vitality INTEGER DEFAULT 1,
        insight INTEGER DEFAULT 1,
        tough INTEGER DEFAULT 1,
        beauty INTEGER DEFAULT 1,
        cool INTEGER DEFAULT 1,
        cute INTEGER DEFAULT 1,
        clever INTEGER DEFAULT 1,
        skills_json TEXT DEFAULT '{}',
        hp INTEGER DEFAULT 6,
        max_hp INTEGER DEFAULT 6,
        will_points INTEGER DEFAULT 8,
        money INTEGER DEFAULT 1500,
        inventory TEXT DEFAULT '',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)
    conn.execute("""
    CREATE TABLE IF NOT EXISTS custom_pokemon (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trainer_id INTEGER,
        species_id TEXT NOT NULL,
        species_name TEXT NOT NULL,
        nickname TEXT,
        type1 TEXT NOT NULL,
        type2 TEXT,
        gender TEXT DEFAULT 'M',
        nature TEXT DEFAULT 'Ardita',
        rank TEXT DEFAULT 'Principiante',
        base_hp INTEGER NOT NULL DEFAULT 4,
        hp INTEGER NOT NULL DEFAULT 5,
        strength INTEGER NOT NULL DEFAULT 1,
        max_strength INTEGER NOT NULL DEFAULT 5,
        dexterity INTEGER NOT NULL DEFAULT 1,
        max_dexterity INTEGER NOT NULL DEFAULT 5,
        vitality INTEGER NOT NULL DEFAULT 1,
        max_vitality INTEGER NOT NULL DEFAULT 5,
        special INTEGER NOT NULL DEFAULT 1,
        max_special INTEGER NOT NULL DEFAULT 5,
        insight INTEGER NOT NULL DEFAULT 1,
        max_insight INTEGER NOT NULL DEFAULT 5,
        ability TEXT NOT NULL,
        ability_effect TEXT,
        moves_json TEXT NOT NULL DEFAULT '[]',
        held_item TEXT,
        notes TEXT,
        image TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (trainer_id) REFERENCES trainers(id) ON DELETE SET NULL
    );
    """)
    conn.commit()
    conn.close()

ensure_database()

app = Flask(
    __name__,
    template_folder=os.path.join(os.path.dirname(__file__), "templates"),
    static_folder=os.path.join(os.path.dirname(__file__), "static")
)

def get_db():
    conn = sqlite3.connect(DB_PATH, timeout=30.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA synchronous = NORMAL;")
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

# In-memory caching for ultra-fast response times on smartphones
CACHE = {
    "pokedex_default": None,
    "moves_default": None,
    "abilities_default": None,
    "items_default": None,
    "natures_default": None
}

# ----------------- STATIC ASSETS & PWA -----------------

@app.route("/images/<folder>/<path:filename>")
def serve_image(folder, filename):
    folder_path = os.path.join(IMAGES_DIR, folder)
    if not os.path.exists(folder_path):
        return jsonify({"error": "Cartella immagini non trovata"}), 404
    # Cache images for 30 days for instant mobile page loading
    return send_from_directory(folder_path, filename, max_age=2592000)

@app.route("/manifest.json")
def serve_manifest():
    return send_from_directory(app.static_folder, "manifest.json", mimetype="application/manifest+json")

@app.route("/sw.js")
def serve_sw():
    response = send_from_directory(app.static_folder, "sw.js", mimetype="application/javascript")
    response.headers["Service-Worker-Allowed"] = "/"
    return response

# ----------------- NETWORK & SYSTEM INFO -----------------

@app.route("/api/network-info")
def api_network_info():
    port = int(os.environ.get("PORT", 5000))
    lan_ip = get_lan_ip()
    return jsonify({
        "lan_ip": lan_ip,
        "port": port,
        "url": f"http://{lan_ip}:{port}/",
        "local_url": f"http://127.0.0.1:{port}/"
    })

# ----------------- API ENDPOINTS -----------------

@app.route("/api/stats")
def api_stats():
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM pokedex")
    pokemon_count = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM moves")
    moves_count = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM abilities")
    abilities_count = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM items")
    items_count = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM natures")
    natures_count = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM trainers")
    trainers_count = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM custom_pokemon")
    custom_poke_count = c.fetchone()[0]
    conn.close()

    return jsonify({
        "pokemon": pokemon_count,
        "moves": moves_count,
        "abilities": abilities_count,
        "items": items_count,
        "natures": natures_count,
        "trainers": trainers_count,
        "custom_pokemon": custom_poke_count
    })

@app.route("/api/pokedex")
def api_pokedex_list():
    query = request.args.get("q", "").strip().lower()
    raw_type = request.args.get("type", "").strip().lower()
    type_filter = PARAM_TYPE_MAP.get(raw_type, request.args.get("type", "").strip())
    raw_rank = request.args.get("rank", "").strip().lower()
    rank_filter = PARAM_RANK_MAP.get(raw_rank, request.args.get("rank", "").strip())
    starter_only = request.args.get("starter", "").lower() == "true"
    legendary_only = request.args.get("legendary", "").lower() == "true"
    sort_by = request.args.get("sort", "number")

    is_default = (
        not query and
        (not type_filter or type_filter.lower() in ["all", "tutti"]) and
        (not rank_filter or rank_filter.lower() in ["all", "tutti"]) and
        not starter_only and
        not legendary_only and
        sort_by == "number"
    )

    if is_default and CACHE["pokedex_default"] is not None:
        return CACHE["pokedex_default"]

    sql = """
        SELECT _id, Number, DexID, Name, Type1, Type2, BaseHP,
               Strength, MaxStrength, Dexterity, MaxDexterity,
               Vitality, MaxVitality, Special, MaxSpecial,
               Insight, MaxInsight, Ability1, Ability2,
               RecommendedRank, GenderType, Legendary, GoodStarter,
               DexCategory, Image, BookImageName, BookShinyImageName
        FROM pokedex
        WHERE 1=1
    """
    params = []

    if query:
        sql += " AND (LOWER(Name) LIKE ? OR DexID LIKE ? OR CAST(Number AS TEXT) LIKE ? OR LOWER(DexCategory) LIKE ?)"
        pattern = f"%{query}%"
        params.extend([pattern, pattern, pattern, pattern])

    if type_filter and type_filter.lower() not in ["all", "tutti"]:
        sql += " AND (Type1 = ? OR Type2 = ?)"
        params.extend([type_filter, type_filter])

    if rank_filter and rank_filter.lower() not in ["all", "tutti"]:
        sql += " AND RecommendedRank = ?"
        params.append(rank_filter)

    if starter_only:
        sql += " AND GoodStarter = 1"

    if legendary_only:
        sql += " AND Legendary = 1"

    if sort_by == "name":
        sql += " ORDER BY Name ASC"
    elif sort_by == "name_desc":
        sql += " ORDER BY Name DESC"
    elif sort_by == "hp":
        sql += " ORDER BY BaseHP DESC, Number ASC"
    elif sort_by == "stats":
        sql += " ORDER BY (Strength + Dexterity + Vitality + Special + Insight) DESC, Number ASC"
    elif sort_by == "number_desc":
        sql += " ORDER BY Number DESC, DexID DESC"
    else:
        sql += " ORDER BY Number ASC, DexID ASC"

    conn = get_db()
    c = conn.cursor()
    c.execute(sql, params)
    rows = [dict(r) for r in c.fetchall()]
    conn.close()

    resp = jsonify(rows)
    if is_default:
        CACHE["pokedex_default"] = resp
    return resp

@app.route("/api/pokedex/<poke_id>")
def api_pokedex_detail(poke_id):
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM pokedex WHERE _id = ? OR DexID = ?", (poke_id, poke_id))
    row = c.fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Specie Pokémon non trovata"}), 404

    poke = dict(row)
    if "RawJSON" in poke:
        del poke["RawJSON"]

    # Evolutions
    c.execute("""
        SELECT ToPokemon, FromPokemon, Kind, Speed, Item, Stat, Value, Special
        FROM pokedex_evolutions
        WHERE pokemon_id = ?
    """, (poke["_id"],))
    poke["Evolutions"] = [dict(r) for r in c.fetchall()]

    # Learnset / Moves
    c.execute("""
        SELECT pm.Learned, pm.Name, m.Type, m.Category, m.Power, m.Damage1, m.Damage2,
               m.Accuracy1, m.Accuracy2, m.Target, m.Effect, m.Description, m._id as move_id
        FROM pokedex_moves pm
        LEFT JOIN moves m ON pm.Name = m.Name
        WHERE pm.pokemon_id = ?
        ORDER BY
            CASE pm.Learned
                WHEN 'Principiante' THEN 1
                WHEN 'Starter' THEN 1
                WHEN 'Novizio' THEN 2
                WHEN 'Rookie' THEN 2
                WHEN 'Standard' THEN 3
                WHEN 'Avanzato' THEN 4
                WHEN 'Advanced' THEN 4
                WHEN 'Esperto' THEN 5
                WHEN 'Expert' THEN 5
                WHEN 'Asso' THEN 6
                WHEN 'Ace' THEN 6
                WHEN 'Maestro' THEN 7
                WHEN 'Master' THEN 7
                WHEN 'Campione' THEN 8
                WHEN 'Champion' THEN 8
                ELSE 9
            END,
            pm.Name ASC
    """, (poke["_id"],))
    poke["Moves"] = [dict(r) for r in c.fetchall()]

    # Abilities details
    ability_names = [a for a in [poke.get("Ability1"), poke.get("Ability2"), poke.get("HiddenAbility"), poke.get("EventAbilities")] if a]
    poke["AbilitiesDetails"] = {}
    if ability_names:
        placeholders = ",".join("?" for _ in ability_names)
        c.execute(f"SELECT Name, Effect, Description FROM abilities WHERE Name IN ({placeholders})", ability_names)
        for ab in c.fetchall():
            poke["AbilitiesDetails"][ab["Name"]] = dict(ab)

    conn.close()
    return jsonify(poke)

@app.route("/api/moves")
def api_moves_list():
    query = request.args.get("q", "").strip().lower()
    raw_type = request.args.get("type", "").strip().lower()
    type_filter = PARAM_TYPE_MAP.get(raw_type, request.args.get("type", "").strip())
    raw_cat = request.args.get("category", "").strip().lower()
    cat_filter = PARAM_CAT_MAP.get(raw_cat, request.args.get("category", "").strip())
    target_filter = request.args.get("target", "").strip()

    is_default = (
        not query and
        (not type_filter or type_filter.lower() in ["all", "tutti"]) and
        (not cat_filter or cat_filter.lower() in ["all", "tutti"]) and
        (not target_filter or target_filter.lower() in ["all", "tutti"])
    )

    if is_default and CACHE["moves_default"] is not None:
        return CACHE["moves_default"]

    sql = """
        SELECT _id, Name, Type, Power, Damage1, Damage2, Accuracy1, Accuracy2, Target, Effect, Description, Category
        FROM moves
        WHERE 1=1
    """
    params = []

    if query:
        sql += " AND (LOWER(Name) LIKE ? OR LOWER(Effect) LIKE ? OR LOWER(Description) LIKE ?)"
        pattern = f"%{query}%"
        params.extend([pattern, pattern, pattern])

    if type_filter and type_filter.lower() not in ["all", "tutti"]:
        sql += " AND Type = ?"
        params.append(type_filter)

    if cat_filter and cat_filter.lower() not in ["all", "tutti"]:
        sql += " AND Category = ?"
        params.append(cat_filter)

    if target_filter and target_filter.lower() not in ["all", "tutti"]:
        sql += " AND Target = ?"
        params.append(target_filter)

    sql += " ORDER BY Name ASC"

    conn = get_db()
    c = conn.cursor()
    c.execute(sql, params)
    rows = [dict(r) for r in c.fetchall()]
    conn.close()

    resp = jsonify(rows)
    if is_default:
        CACHE["moves_default"] = resp
    return resp

@app.route("/api/moves/<move_id>")
def api_move_detail(move_id):
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM moves WHERE _id = ? OR LOWER(Name) = LOWER(?)", (move_id, move_id))
    row = c.fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Mossa non trovata"}), 404

    move = dict(row)
    if "RawJSON" in move:
        del move["RawJSON"]

    # Pokémon that learn this move
    c.execute("""
        SELECT p._id, p.DexID, p.Name, pm.Learned, p.Image
        FROM pokedex_moves pm
        JOIN pokedex p ON pm.pokemon_id = p._id
        WHERE pm.Name = ?
        ORDER BY p.Number ASC, p.DexID ASC
    """, (move["Name"],))
    move["LearnedBy"] = [dict(r) for r in c.fetchall()]

    conn.close()
    return jsonify(move)

@app.route("/api/abilities")
def api_abilities_list():
    query = request.args.get("q", "").strip().lower()
    is_default = not query

    if is_default and CACHE["abilities_default"] is not None:
        return CACHE["abilities_default"]

    sql = "SELECT _id, Name, Effect, Description FROM abilities WHERE 1=1"
    params = []

    if query:
        sql += " AND (LOWER(Name) LIKE ? OR LOWER(Effect) LIKE ? OR LOWER(Description) LIKE ?)"
        pattern = f"%{query}%"
        params.extend([pattern, pattern, pattern])

    sql += " ORDER BY Name ASC"

    conn = get_db()
    c = conn.cursor()
    c.execute(sql, params)
    rows = [dict(r) for r in c.fetchall()]
    conn.close()

    resp = jsonify(rows)
    if is_default:
        CACHE["abilities_default"] = resp
    return resp

@app.route("/api/abilities/<ability_id>")
def api_ability_detail(ability_id):
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM abilities WHERE _id = ? OR LOWER(Name) = LOWER(?)", (ability_id, ability_id))
    row = c.fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Abilità non trovata"}), 404

    ab = dict(row)
    if "RawJSON" in ab:
        del ab["RawJSON"]

    c.execute("""
        SELECT _id, DexID, Name, 'Abilità 1' as Slot, Image FROM pokedex WHERE Ability1 = ?
        UNION
        SELECT _id, DexID, Name, 'Abilità 2' as Slot, Image FROM pokedex WHERE Ability2 = ?
        UNION
        SELECT _id, DexID, Name, 'Abilità Nascosta' as Slot, Image FROM pokedex WHERE HiddenAbility = ?
        UNION
        SELECT _id, DexID, Name, 'Abilità Evento' as Slot, Image FROM pokedex WHERE EventAbilities = ?
        ORDER BY DexID ASC
    """, (ab["Name"], ab["Name"], ab["Name"], ab["Name"]))
    ab["PokemonWithAbility"] = [dict(r) for r in c.fetchall()]

    conn.close()
    return jsonify(ab)

@app.route("/api/items")
def api_items_list():
    query = request.args.get("q", "").strip().lower()
    raw_pocket = request.args.get("pocket", "").strip().lower()
    pocket_filter = PARAM_POCKET_MAP.get(raw_pocket, request.args.get("pocket", "").strip())

    is_default = not query and (not pocket_filter or pocket_filter.lower() in ["all", "tutti"])

    if is_default and CACHE["items_default"] is not None:
        return CACHE["items_default"]

    sql = """
        SELECT _id, Name, Pocket, Category, Description, OneUse, PMDPrice, TrainerPrice,
               HealthRestored, Cures, Boost, Value, Image
        FROM items
        WHERE 1=1
    """
    params = []

    if query:
        sql += " AND (LOWER(Name) LIKE ? OR LOWER(Description) LIKE ? OR LOWER(Category) LIKE ?)"
        pattern = f"%{query}%"
        params.extend([pattern, pattern, pattern])

    if pocket_filter and pocket_filter.lower() not in ["all", "tutti"]:
        sql += " AND Pocket = ?"
        params.append(pocket_filter)

    sql += " ORDER BY Pocket ASC, Name ASC"

    conn = get_db()
    c = conn.cursor()
    c.execute(sql, params)
    rows = [dict(r) for r in c.fetchall()]
    conn.close()

    resp = jsonify(rows)
    if is_default:
        CACHE["items_default"] = resp
    return resp

@app.route("/api/natures")
def api_natures_list():
    if CACHE["natures_default"] is not None:
        return CACHE["natures_default"]

    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT _id, Name, Nature, Confidence, Description, Keywords FROM natures ORDER BY Name ASC")
    rows = [dict(r) for r in c.fetchall()]
    conn.close()

    resp = jsonify(rows)
    CACHE["natures_default"] = resp
    return resp

@app.route("/api/species-info/<species_id>")
def api_species_info(species_id):
    conn = get_db()
    c = conn.cursor()
    c.execute("""
        SELECT _id, Number, DexID, Name, Type1, Type2, BaseHP,
               Strength, MaxStrength, Dexterity, MaxDexterity,
               Vitality, MaxVitality, Special, MaxSpecial,
               Insight, MaxInsight, Ability1, Ability2, HiddenAbility, EventAbilities,
               RecommendedRank, Image
        FROM pokedex
        WHERE _id = ? OR LOWER(Name) = ?
    """, (species_id, species_id.lower()))
    row = c.fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Specie non trovata"}), 404

    species = dict(row)
    ability_names = [species.get("Ability1"), species.get("Ability2"), species.get("HiddenAbility"), species.get("EventAbilities")]
    ability_names = [a for a in ability_names if a]
    abilities = []
    if ability_names:
        placeholders = ",".join("?" for _ in ability_names)
        c.execute(f"SELECT _id, Name, Effect, Description FROM abilities WHERE Name IN ({placeholders})", ability_names)
        abilities = [dict(r) for r in c.fetchall()]
    species["NaturalAbilities"] = abilities

    c.execute("""
        SELECT pm.Learned, pm.Name,
               m._id, m.Type, m.Power, m.Damage1, m.Damage2,
               m.Accuracy1, m.Accuracy2, m.Target, m.Effect, m.Category
        FROM pokedex_moves pm
        LEFT JOIN moves m ON LOWER(pm.Name) = LOWER(m.Name)
        WHERE pm.pokemon_id = ?
        ORDER BY pm.id ASC
    """, (species["_id"],))
    species["LearnsetMoves"] = [dict(r) for r in c.fetchall()]

    conn.close()
    return jsonify(species)

# ----------------- TRAINERS / CHARACTERS -----------------

@app.route("/api/trainers", methods=["GET", "POST"])
def api_trainers():
    conn = get_db()
    c = conn.cursor()

    if request.method == "POST":
        data = request.json or {}
        name = data.get("name", "Nuovo Allenatore").strip() or "Nuovo Allenatore"
        age = int(data.get("age", 14) or 14)
        concept = data.get("concept", "")
        nature = data.get("nature", "Ardita")
        rank = data.get("rank", "Principiante")
        strength = int(data.get("strength", 1))
        dexterity = int(data.get("dexterity", 1))
        vitality = int(data.get("vitality", 1))
        insight = int(data.get("insight", 1))
        tough = int(data.get("tough", 1))
        beauty = int(data.get("beauty", 1))
        cool = int(data.get("cool", 1))
        cute = int(data.get("cute", 1))
        clever = int(data.get("clever", 1))
        skills_json = json.dumps(data.get("skills", {}))
        hp = int(data.get("hp", 5 + vitality))
        max_hp = int(data.get("max_hp", 5 + vitality))
        will_points = int(data.get("will_points", 8))
        money = int(data.get("money", 1500))
        inventory = data.get("inventory", "")
        notes = data.get("notes", "")

        c.execute("""
            INSERT INTO trainers (
                name, age, concept, nature, rank,
                strength, dexterity, vitality, insight,
                tough, beauty, cool, cute, clever,
                skills_json, hp, max_hp, will_points, money, inventory, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            name, age, concept, nature, rank,
            strength, dexterity, vitality, insight,
            tough, beauty, cool, cute, clever,
            skills_json, hp, max_hp, will_points, money, inventory, notes
        ))
        conn.commit()
        new_id = c.lastrowid
        conn.close()
        return jsonify({"success": True, "id": new_id, "message": "Personaggio creato!"}), 201

    # GET: return list of trainers with count of pokemon
    c.execute("""
        SELECT t.*, COUNT(cp.id) as pokemon_count
        FROM trainers t
        LEFT JOIN custom_pokemon cp ON t.id = cp.trainer_id
        GROUP BY t.id
        ORDER BY t.created_at DESC
    """)
    rows = [dict(r) for r in c.fetchall()]
    for r in rows:
        if r.get("skills_json"):
            try:
                r["skills"] = json.loads(r["skills_json"])
            except:
                r["skills"] = {}
        else:
            r["skills"] = {}
    conn.close()
    return jsonify(rows)

@app.route("/api/trainers/<int:trainer_id>", methods=["GET", "PUT", "DELETE"])
def api_trainer_detail(trainer_id):
    conn = get_db()
    c = conn.cursor()

    if request.method == "DELETE":
        c.execute("DELETE FROM trainers WHERE id = ?", (trainer_id,))
        c.execute("UPDATE custom_pokemon SET trainer_id = NULL WHERE trainer_id = ?", (trainer_id,))
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": "Personaggio eliminato"})

    if request.method == "PUT":
        data = request.json or {}
        c.execute("""
            UPDATE trainers SET
                name = ?, age = ?, concept = ?, nature = ?, rank = ?,
                strength = ?, dexterity = ?, vitality = ?, insight = ?,
                tough = ?, beauty = ?, cool = ?, cute = ?, clever = ?,
                skills_json = ?, hp = ?, max_hp = ?, will_points = ?,
                money = ?, inventory = ?, notes = ?
            WHERE id = ?
        """, (
            data.get("name", "Allenatore"),
            int(data.get("age", 14) or 14),
            data.get("concept", ""),
            data.get("nature", "Ardita"),
            data.get("rank", "Principiante"),
            int(data.get("strength", 1)),
            int(data.get("dexterity", 1)),
            int(data.get("vitality", 1)),
            int(data.get("insight", 1)),
            int(data.get("tough", 1)),
            int(data.get("beauty", 1)),
            int(data.get("cool", 1)),
            int(data.get("cute", 1)),
            int(data.get("clever", 1)),
            json.dumps(data.get("skills", {})),
            int(data.get("hp", 6)),
            int(data.get("max_hp", 6)),
            int(data.get("will_points", 8)),
            int(data.get("money", 1500)),
            data.get("inventory", ""),
            data.get("notes", ""),
            trainer_id
        ))
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": "Personaggio aggiornato!"})

    # GET: detail with team
    c.execute("SELECT * FROM trainers WHERE id = ?", (trainer_id,))
    row = c.fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Personaggio non trovato"}), 404

    tr = dict(row)
    if tr.get("skills_json"):
        try:
            tr["skills"] = json.loads(tr["skills_json"])
        except:
            tr["skills"] = {}

    c.execute("SELECT * FROM custom_pokemon WHERE trainer_id = ? ORDER BY id ASC", (trainer_id,))
    poke_rows = [dict(r) for r in c.fetchall()]
    for p in poke_rows:
        if p.get("moves_json"):
            try:
                p["moves"] = json.loads(p["moves_json"])
            except:
                p["moves"] = []
    tr["team"] = poke_rows

    conn.close()
    return jsonify(tr)

# ----------------- CUSTOM POKÉMON -----------------

@app.route("/api/custom-pokemon", methods=["GET", "POST"])
def api_custom_pokemon():
    conn = get_db()
    c = conn.cursor()

    if request.method == "POST":
        data = request.json or {}
        c.execute("""
            INSERT INTO custom_pokemon (
                trainer_id, species_id, species_name, nickname,
                type1, type2, gender, nature, rank,
                base_hp, hp, strength, max_strength,
                dexterity, max_dexterity, vitality, max_vitality,
                special, max_special, insight, max_insight,
                ability, ability_effect, moves_json, held_item, notes, image
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            data.get("trainer_id") if data.get("trainer_id") else None,
            data.get("species_id", "bulbasaur"),
            data.get("species_name", "Bulbasaur"),
            data.get("nickname", ""),
            data.get("type1", "Erba"),
            data.get("type2", "Veleno"),
            data.get("gender", "M"),
            data.get("nature", "Ardita"),
            data.get("rank", "Principiante"),
            int(data.get("base_hp", 4)),
            int(data.get("hp", 5)),
            int(data.get("strength", 1)),
            int(data.get("max_strength", 5)),
            int(data.get("dexterity", 1)),
            int(data.get("max_dexterity", 5)),
            int(data.get("vitality", 1)),
            int(data.get("max_vitality", 5)),
            int(data.get("special", 1)),
            int(data.get("max_special", 5)),
            int(data.get("insight", 1)),
            int(data.get("max_insight", 5)),
            data.get("ability", ""),
            data.get("ability_effect", ""),
            json.dumps(data.get("moves", [])),
            data.get("held_item", ""),
            data.get("notes", ""),
            data.get("image", "")
        ))
        conn.commit()
        new_id = c.lastrowid
        conn.close()
        return jsonify({"success": True, "id": new_id, "message": "Pokémon personalizzato creato!"}), 201

    # GET: all custom pokemon
    c.execute("""
        SELECT cp.*, t.name as trainer_name
        FROM custom_pokemon cp
        LEFT JOIN trainers t ON cp.trainer_id = t.id
        ORDER BY cp.created_at DESC
    """)
    rows = [dict(r) for r in c.fetchall()]
    for p in rows:
        if p.get("moves_json"):
            try:
                p["moves"] = json.loads(p["moves_json"])
            except:
                p["moves"] = []
    conn.close()
    return jsonify(rows)

@app.route("/api/custom-pokemon/<int:poke_id>", methods=["GET", "PUT", "DELETE"])
def api_custom_pokemon_detail(poke_id):
    conn = get_db()
    c = conn.cursor()

    if request.method == "DELETE":
        c.execute("DELETE FROM custom_pokemon WHERE id = ?", (poke_id,))
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": "Pokémon eliminato"})

    if request.method == "PUT":
        data = request.json or {}
        c.execute("""
            UPDATE custom_pokemon SET
                trainer_id = ?, nickname = ?, type1 = ?, type2 = ?,
                gender = ?, nature = ?, rank = ?, hp = ?,
                strength = ?, max_strength = ?, dexterity = ?, max_dexterity = ?,
                vitality = ?, max_vitality = ?, special = ?, max_special = ?,
                insight = ?, max_insight = ?, ability = ?, ability_effect = ?,
                moves_json = ?, held_item = ?, notes = ?
            WHERE id = ?
        """, (
            data.get("trainer_id") if data.get("trainer_id") else None,
            data.get("nickname", ""),
            data.get("type1", "Normale"), data.get("type2", ""),
            data.get("gender", "M"), data.get("nature", "Ardita"),
            data.get("rank", "Principiante"), int(data.get("hp", 5)),
            int(data.get("strength", 1)), int(data.get("max_strength", 5)),
            int(data.get("dexterity", 1)), int(data.get("max_dexterity", 5)),
            int(data.get("vitality", 1)), int(data.get("max_vitality", 5)),
            int(data.get("special", 1)), int(data.get("max_special", 5)),
            int(data.get("insight", 1)), int(data.get("max_insight", 5)),
            data.get("ability", ""), data.get("ability_effect", ""),
            json.dumps(data.get("moves", [])),
            data.get("held_item", ""), data.get("notes", ""),
            poke_id
        ))
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": "Pokémon aggiornato!"})

    c.execute("""
        SELECT cp.*, t.name as trainer_name
        FROM custom_pokemon cp
        LEFT JOIN trainers t ON cp.trainer_id = t.id
        WHERE cp.id = ?
    """, (poke_id,))
    row = c.fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Pokémon non trovato"}), 404

    poke = dict(row)
    if poke.get("moves_json"):
        try:
            poke["moves"] = json.loads(poke["moves_json"])
        except:
            poke["moves"] = []

    conn.close()
    return jsonify(poke)

# ----------------- FRONT-END ROUTING -----------------

@app.route("/")
def index():
    return render_template("index.html")

def open_browser():
    port = int(os.environ.get("PORT", 5000))
    webbrowser.open_new(f"http://127.0.0.1:{port}/")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    bind_host = os.environ.get("BIND_HOST", "0.0.0.0")
    lan_ip = get_lan_ip()

    print("=" * 64)
    print("        POKEROLEDEX 3.0 - ANDROID & MOBILE EDITION        ")
    print("=" * 64)
    print(f"[*] Server attivo e pronto per telefoni Android e PC!")
    print(f"[*] Indirizzo locale PC:      http://127.0.0.1:{port}/")
    print(f"[*] Indirizzo Wi-Fi Telefono: http://{lan_ip}:{port}/")
    print("=" * 64)

    if os.environ.get("OPEN_BROWSER", "1") == "1":
        Timer(1.2, open_browser).start()

    app.run(host=bind_host, port=port, debug=False)
