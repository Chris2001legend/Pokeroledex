"""
Pokeroledex Web Application Server
Serves the Pokérole companion app, REST API, and static assets.
Auto-installs dependencies and initializes database if missing.
"""

import os
import sys
import json
import sqlite3
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
        print("Installa manualmente le librerie con: pip install -r requirements.txt")
        sys.exit(1)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "DB", "pokeroledex.sqlite")
STORAGE_DIR = os.path.join(BASE_DIR, "Storage")
IMAGES_DIR = os.path.join(STORAGE_DIR, "images")

# Auto-check database: if missing or empty, run importer automatically!
def ensure_database():
    if not os.path.exists(DB_PATH) or os.path.getsize(DB_PATH) == 0:
        print("Database non trovato o vuoto. Avvio importazione automatica da Storage/v3.0...")
        import importer
        importer.run_import()

    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("""
    CREATE TABLE IF NOT EXISTS trainers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        age INTEGER DEFAULT 14,
        concept TEXT,
        nature TEXT,
        rank TEXT DEFAULT 'Starter',
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
        nature TEXT DEFAULT 'Hardy',
        rank TEXT DEFAULT 'Starter',
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

# In-memory caching for ultra-fast response times
CACHE = {
    "pokedex_default": None,
    "moves_default": None,
    "abilities_default": None,
    "items_default": None,
    "natures_default": None
}

# ----------------- STATIC ASSETS & IMAGES -----------------

@app.route("/images/<folder>/<path:filename>")
def serve_image(folder, filename):
    folder_path = os.path.join(IMAGES_DIR, folder)
    if not os.path.exists(folder_path):
        return jsonify({"error": "Folder not found"}), 404
    # Cache images for 30 days in the browser for ultra-fast subsequent loads
    return send_from_directory(folder_path, filename, max_age=2592000)

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
    type_filter = request.args.get("type", "").strip()
    rank_filter = request.args.get("rank", "").strip()
    starter_only = request.args.get("starter", "").lower() == "true"
    legendary_only = request.args.get("legendary", "").lower() == "true"
    sort_by = request.args.get("sort", "number")

    is_default = (
        not query and
        (not type_filter or type_filter == "All") and
        (not rank_filter or rank_filter == "All") and
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

    if type_filter and type_filter != "All":
        sql += " AND (Type1 = ? OR Type2 = ?)"
        params.extend([type_filter, type_filter])

    if rank_filter and rank_filter != "All":
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

@app.route("/api/pokedex/<pokemon_id>")
def api_pokedex_detail(pokemon_id):
    conn = get_db()
    c = conn.cursor()

    # Get Pokémon record
    c.execute("SELECT * FROM pokedex WHERE _id = ? OR LOWER(Name) = ?", (pokemon_id, pokemon_id.lower()))
    row = c.fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Pokemon not found"}), 404

    data = dict(row)
    actual_id = data["_id"]

    # Evolutions
    c.execute("""
        SELECT ToPokemon, FromPokemon, Kind, Speed, Item, Stat, Value, Special
        FROM pokedex_evolutions
        WHERE pokemon_id = ?
    """, (actual_id,))
    data["Evolutions"] = [dict(r) for r in c.fetchall()]

    # Learnset with full Move details
    c.execute("""
        SELECT pm.Learned, pm.Name,
               m._id AS MoveID, m.Type, m.Power, m.Damage1, m.Damage2,
               m.Accuracy1, m.Accuracy2, m.Target, m.Effect, m.Description, m.Category
        FROM pokedex_moves pm
        LEFT JOIN moves m ON LOWER(pm.Name) = LOWER(m.Name)
        WHERE pm.pokemon_id = ?
        ORDER BY pm.id ASC
    """, (actual_id,))
    data["Moves"] = [dict(r) for r in c.fetchall()]

    # Ability descriptions
    abilities_to_fetch = [data.get("Ability1"), data.get("Ability2"), data.get("HiddenAbility"), data.get("EventAbilities")]
    abilities_to_fetch = [a for a in abilities_to_fetch if a]
    abilities_info = {}
    if abilities_to_fetch:
        placeholders = ",".join("?" for _ in abilities_to_fetch)
        c.execute(f"SELECT _id, Name, Effect, Description FROM abilities WHERE Name IN ({placeholders})", abilities_to_fetch)
        for r in c.fetchall():
            abilities_info[r["Name"]] = dict(r)
    data["AbilitiesDetails"] = abilities_info

    conn.close()
    return jsonify(data)

@app.route("/api/moves")
def api_moves_list():
    query = request.args.get("q", "").strip().lower()
    type_filter = request.args.get("type", "").strip()
    category_filter = request.args.get("category", "").strip()
    target_filter = request.args.get("target", "").strip()

    is_default = (not query and (not type_filter or type_filter == "All") and
                  (not category_filter or category_filter == "All") and
                  (not target_filter or target_filter == "All"))

    if is_default and CACHE["moves_default"] is not None:
        return CACHE["moves_default"]

    sql = """
        SELECT _id, Name, Type, Power, Damage1, Damage2,
               Accuracy1, Accuracy2, Target, Effect, Description, Category
        FROM moves
        WHERE 1=1
    """
    params = []

    if query:
        sql += " AND (LOWER(Name) LIKE ? OR LOWER(Effect) LIKE ? OR LOWER(Description) LIKE ?)"
        p = f"%{query}%"
        params.extend([p, p, p])

    if type_filter and type_filter != "All":
        sql += " AND Type = ?"
        params.append(type_filter)

    if category_filter and category_filter != "All":
        sql += " AND Category = ?"
        params.append(category_filter)

    if target_filter and target_filter != "All":
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
    c.execute("SELECT * FROM moves WHERE _id = ? OR LOWER(Name) = ?", (move_id, move_id.lower()))
    row = c.fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Move not found"}), 404
    data = dict(row)

    # Find Pokémon that learn this move
    c.execute("""
        SELECT DISTINCT p._id, p.Number, p.DexID, p.Name, p.Type1, p.Type2, p.Image, pm.Learned
        FROM pokedex_moves pm
        JOIN pokedex p ON pm.pokemon_id = p._id
        WHERE LOWER(pm.Name) = LOWER(?)
        ORDER BY p.Number ASC
    """, (data["Name"],))
    data["LearnedBy"] = [dict(r) for r in c.fetchall()]

    conn.close()
    return jsonify(data)

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
        p = f"%{query}%"
        params.extend([p, p, p])

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
    c.execute("SELECT * FROM abilities WHERE _id = ? OR LOWER(Name) = ?", (ability_id, ability_id.lower()))
    row = c.fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Ability not found"}), 404
    data = dict(row)

    # Find Pokémon that have this ability
    name = data["Name"]
    c.execute("""
        SELECT _id, Number, DexID, Name, Type1, Type2, Image,
               CASE
                   WHEN Ability1 = ? THEN 'Ability 1'
                   WHEN Ability2 = ? THEN 'Ability 2'
                   WHEN HiddenAbility = ? THEN 'Hidden Ability'
                   WHEN EventAbilities = ? THEN 'Event Ability'
                   ELSE 'Ability'
               END as Slot
        FROM pokedex
        WHERE Ability1 = ? OR Ability2 = ? OR HiddenAbility = ? OR EventAbilities = ?
        ORDER BY Number ASC
    """, (name, name, name, name, name, name, name, name))
    data["PokemonWithAbility"] = [dict(r) for r in c.fetchall()]

    conn.close()
    return jsonify(data)

@app.route("/api/items")
def api_items_list():
    query = request.args.get("q", "").strip().lower()
    pocket_filter = request.args.get("pocket", "").strip()
    pmd_filter = request.args.get("pmd", "").strip()

    is_default = not query and (not pocket_filter or pocket_filter == "All") and not pmd_filter

    if is_default and CACHE["items_default"] is not None:
        return CACHE["items_default"]

    sql = """
        SELECT _id, Name, Source, Author, PMD, Pocket, Category,
               Description, OneUse, PMDPrice, TrainerPrice, ForTypes,
               ForPokemon, HealthRestored, Cures, Boost, Value, MaxMovePower, Image
        FROM items WHERE 1=1
    """
    params = []

    if query:
        sql += " AND (LOWER(Name) LIKE ? OR LOWER(Description) LIKE ? OR LOWER(Category) LIKE ?)"
        p = f"%{query}%"
        params.extend([p, p, p])

    if pocket_filter and pocket_filter != "All":
        sql += " AND Pocket = ?"
        params.append(pocket_filter)

    if pmd_filter == "pmd":
        sql += " AND PMD = 1"
    elif pmd_filter == "standard":
        sql += " AND PMD = 0"

    sql += " ORDER BY Name ASC"

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

# ----------------- TRAINERS & CUSTOM POKEMON APIS -----------------

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

    # Fetch natural abilities with effects
    ability_names = [species.get("Ability1"), species.get("Ability2"), species.get("HiddenAbility"), species.get("EventAbilities")]
    ability_names = [a for a in ability_names if a]
    abilities = []
    if ability_names:
        placeholders = ",".join("?" for _ in ability_names)
        c.execute(f"SELECT _id, Name, Effect, Description FROM abilities WHERE Name IN ({placeholders})", ability_names)
        abilities = [dict(r) for r in c.fetchall()]
    species["NaturalAbilities"] = abilities

    # Fetch natural learnset moves with full move stats
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

@app.route("/api/trainers", methods=["GET", "POST"])
def api_trainers():
    conn = get_db()
    c = conn.cursor()

    if request.method == "POST":
        data = request.get_json() or {}
        name = data.get("name", "").strip()
        if not name:
            conn.close()
            return jsonify({"error": "Il nome dell'allenatore è obbligatorio"}), 400

        age = int(data.get("age", 14))
        concept = data.get("concept", "")
        nature = data.get("nature", "Hardy")
        rank = data.get("rank", "Starter")
        strength = int(data.get("strength", 1))
        dexterity = int(data.get("dexterity", 1))
        vitality = int(data.get("vitality", 1))
        insight = int(data.get("insight", 1))
        tough = int(data.get("tough", 1))
        beauty = int(data.get("beauty", 1))
        cool = int(data.get("cool", 1))
        cute = int(data.get("cute", 1))
        clever = int(data.get("clever", 1))
        skills_json = json.dumps(data.get("skills", {}), ensure_ascii=False)
        hp = 5 + vitality
        max_hp = hp
        will_points = int(data.get("will_points", 8))
        money = int(data.get("money", 1500))
        inventory = data.get("inventory", "5x Poké Ball, 2x Pozione")
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
        trainer_id = c.lastrowid
        conn.commit()
        conn.close()
        return jsonify({"success": True, "id": trainer_id, "message": "Allenatore creato con successo!"}), 201

    # GET: List trainers with pokemon count
    c.execute("""
        SELECT t.*, COUNT(cp.id) as pokemon_count
        FROM trainers t
        LEFT JOIN custom_pokemon cp ON t.id = cp.trainer_id
        GROUP BY t.id
        ORDER BY t.id DESC
    """)
    rows = [dict(r) for r in c.fetchall()]
    for r in rows:
        if r.get("skills_json"):
            try:
                r["skills"] = json.loads(r["skills_json"])
            except:
                r["skills"] = {}
        # Fetch team miniatures
        c.execute("SELECT id, species_name, nickname, type1, type2, image, hp, rank FROM custom_pokemon WHERE trainer_id = ?", (r["id"],))
        r["team"] = [dict(p) for p in c.fetchall()]

    conn.close()
    return jsonify(rows)

@app.route("/api/trainers/<int:trainer_id>", methods=["GET", "PUT", "DELETE"])
def api_trainer_detail(trainer_id):
    conn = get_db()
    c = conn.cursor()

    if request.method == "DELETE":
        c.execute("DELETE FROM trainers WHERE id = ?", (trainer_id,))
        # Also detach pokemon
        c.execute("UPDATE custom_pokemon SET trainer_id = NULL WHERE trainer_id = ?", (trainer_id,))
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": "Allenatore eliminato con successo"})

    if request.method == "PUT":
        data = request.get_json() or {}
        name = data.get("name", "").strip()
        if not name:
            conn.close()
            return jsonify({"error": "Il nome è obbligatorio"}), 400

        c.execute("""
            UPDATE trainers SET
                name = ?, age = ?, concept = ?, nature = ?, rank = ?,
                strength = ?, dexterity = ?, vitality = ?, insight = ?,
                tough = ?, beauty = ?, cool = ?, cute = ?, clever = ?,
                skills_json = ?, hp = ?, max_hp = ?, will_points = ?,
                money = ?, inventory = ?, notes = ?
            WHERE id = ?
        """, (
            name, int(data.get("age", 14)), data.get("concept", ""),
            data.get("nature", "Hardy"), data.get("rank", "Starter"),
            int(data.get("strength", 1)), int(data.get("dexterity", 1)),
            int(data.get("vitality", 1)), int(data.get("insight", 1)),
            int(data.get("tough", 1)), int(data.get("beauty", 1)),
            int(data.get("cool", 1)), int(data.get("cute", 1)),
            int(data.get("clever", 1)),
            json.dumps(data.get("skills", {}), ensure_ascii=False),
            int(data.get("hp", 6)), int(data.get("max_hp", 6)),
            int(data.get("will_points", 8)), int(data.get("money", 1500)),
            data.get("inventory", ""), data.get("notes", ""),
            trainer_id
        ))
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": "Allenatore aggiornato!"})

    # GET: Return trainer with full team
    c.execute("SELECT * FROM trainers WHERE id = ?", (trainer_id,))
    row = c.fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Allenatore non trovato"}), 404

    trainer = dict(row)
    if trainer.get("skills_json"):
        try:
            trainer["skills"] = json.loads(trainer["skills_json"])
        except:
            trainer["skills"] = {}

    c.execute("SELECT * FROM custom_pokemon WHERE trainer_id = ? ORDER BY id ASC", (trainer_id,))
    team = []
    for r in c.fetchall():
        poke = dict(r)
        if poke.get("moves_json"):
            try:
                poke["moves"] = json.loads(poke["moves_json"])
            except:
                poke["moves"] = []
        team.append(poke)
    trainer["team"] = team

    conn.close()
    return jsonify(trainer)

@app.route("/api/custom-pokemon", methods=["GET", "POST"])
def api_custom_pokemon():
    conn = get_db()
    c = conn.cursor()

    if request.method == "POST":
        data = request.get_json() or {}
        species_id = data.get("species_id")
        species_name = data.get("species_name")
        if not species_id or not species_name:
            conn.close()
            return jsonify({"error": "Specie Pokémon obbligatoria"}), 400

        trainer_id = data.get("trainer_id")
        if trainer_id:
            try:
                trainer_id = int(trainer_id)
            except:
                trainer_id = None
        else:
            trainer_id = None

        nickname = data.get("nickname", "").strip() or species_name
        type1 = data.get("type1", "Normal")
        type2 = data.get("type2") or None
        gender = data.get("gender", "M")
        nature = data.get("nature", "Hardy")
        rank = data.get("rank", "Starter")

        base_hp = int(data.get("base_hp", 4))
        vitality = int(data.get("vitality", 1))
        ranks_mult = {"Starter": 1, "Rookie": 2, "Standard": 3, "Advanced": 4, "Expert": 5, "Master": 6, "Champion": 7}
        mult = ranks_mult.get(rank, 1)
        hp = int(data.get("hp", base_hp + (vitality * mult)))

        strength = int(data.get("strength", 1))
        max_strength = int(data.get("max_strength", 5))
        dexterity = int(data.get("dexterity", 1))
        max_dexterity = int(data.get("max_dexterity", 5))
        vitality = int(data.get("vitality", 1))
        max_vitality = int(data.get("max_vitality", 5))
        special = int(data.get("special", 1))
        max_special = int(data.get("max_special", 5))
        insight = int(data.get("insight", 1))
        max_insight = int(data.get("max_insight", 5))

        ability = data.get("ability", "")
        ability_effect = data.get("ability_effect", "")
        moves = data.get("moves", [])
        moves_json = json.dumps(moves, ensure_ascii=False)
        held_item = data.get("held_item", "")
        notes = data.get("notes", "")
        image = data.get("image", "")

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
            trainer_id, species_id, species_name, nickname,
            type1, type2, gender, nature, rank,
            base_hp, hp, strength, max_strength,
            dexterity, max_dexterity, vitality, max_vitality,
            special, max_special, insight, max_insight,
            ability, ability_effect, moves_json, held_item, notes, image
        ))
        poke_id = c.lastrowid
        conn.commit()
        conn.close()
        return jsonify({"success": True, "id": poke_id, "message": "Pokémon creato con successo!"}), 201

    # GET: List custom pokemon
    trainer_filter = request.args.get("trainer_id")
    if trainer_filter:
        c.execute("""
            SELECT cp.*, t.name as trainer_name
            FROM custom_pokemon cp
            LEFT JOIN trainers t ON cp.trainer_id = t.id
            WHERE cp.trainer_id = ?
            ORDER BY cp.id DESC
        """, (trainer_filter,))
    else:
        c.execute("""
            SELECT cp.*, t.name as trainer_name
            FROM custom_pokemon cp
            LEFT JOIN trainers t ON cp.trainer_id = t.id
            ORDER BY cp.id DESC
        """)

    rows = [dict(r) for r in c.fetchall()]
    for r in rows:
        if r.get("moves_json"):
            try:
                r["moves"] = json.loads(r["moves_json"])
            except:
                r["moves"] = []
        else:
            r["moves"] = []

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
        return jsonify({"success": True, "message": "Pokémon rimosso con successo"})

    if request.method == "PUT":
        data = request.get_json() or {}
        trainer_id = data.get("trainer_id")
        if trainer_id:
            try: trainer_id = int(trainer_id)
            except: trainer_id = None
        else:
            trainer_id = None

        c.execute("""
            UPDATE custom_pokemon SET
                trainer_id = ?, nickname = ?, gender = ?, nature = ?, rank = ?,
                base_hp = ?, hp = ?, strength = ?, max_strength = ?,
                dexterity = ?, max_dexterity = ?, vitality = ?, max_vitality = ?,
                special = ?, max_special = ?, insight = ?, max_insight = ?,
                ability = ?, ability_effect = ?, moves_json = ?,
                held_item = ?, notes = ?
            WHERE id = ?
        """, (
            trainer_id, data.get("nickname"), data.get("gender", "M"),
            data.get("nature", "Hardy"), data.get("rank", "Starter"),
            int(data.get("base_hp", 4)), int(data.get("hp", 5)),
            int(data.get("strength", 1)), int(data.get("max_strength", 5)),
            int(data.get("dexterity", 1)), int(data.get("max_dexterity", 5)),
            int(data.get("vitality", 1)), int(data.get("max_vitality", 5)),
            int(data.get("special", 1)), int(data.get("max_special", 5)),
            int(data.get("insight", 1)), int(data.get("max_insight", 5)),
            data.get("ability", ""), data.get("ability_effect", ""),
            json.dumps(data.get("moves", []), ensure_ascii=False),
            data.get("held_item", ""), data.get("notes", ""),
            poke_id
        ))
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": "Pokémon aggiornato!"})

    # GET: detail
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
    webbrowser.open_new("http://127.0.0.1:5000/")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    print(f"PokéroleDex avviato su http://127.0.0.1:{port}/")
    # Only open browser if not in testing / background mode
    if os.environ.get("OPEN_BROWSER", "1") == "1":
        Timer(1.2, open_browser).start()
    app.run(host="127.0.0.1", port=port, debug=False)
