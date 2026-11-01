"""
Pokeroledex Database Importer
Imports all v3.0 JSON files into SQLite according to DDL.md specifications.
"""

import os
import sys
import json
import glob
import sqlite3

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(BASE_DIR, "DB", "pokeroledex.sqlite")
STORAGE_DIR = os.path.join(BASE_DIR, "Storage", "v3.0")

def get_db_connection():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.row_factory = sqlite3.Row
    return conn

def init_schema(conn):
    schema_sql = """
    DROP TABLE IF EXISTS pokedex_moves;
    DROP TABLE IF EXISTS pokedex_evolutions;
    DROP TABLE IF EXISTS pokedex;
    DROP TABLE IF EXISTS moves;
    DROP TABLE IF EXISTS abilities;
    DROP TABLE IF EXISTS natures;
    DROP TABLE IF EXISTS items;

    -- Pokedex Table
    CREATE TABLE pokedex (
        _id TEXT PRIMARY KEY,
        Number INTEGER NOT NULL,
        DexID TEXT NOT NULL,
        Name TEXT NOT NULL,
        Type1 TEXT NOT NULL,
        Type2 TEXT,
        BaseHP INTEGER NOT NULL,
        Strength INTEGER NOT NULL,
        MaxStrength INTEGER NOT NULL,
        Dexterity INTEGER NOT NULL,
        MaxDexterity INTEGER NOT NULL,
        Vitality INTEGER NOT NULL,
        MaxVitality INTEGER NOT NULL,
        Special INTEGER NOT NULL,
        MaxSpecial INTEGER NOT NULL,
        Insight INTEGER NOT NULL,
        MaxInsight INTEGER NOT NULL,
        Ability1 TEXT NOT NULL,
        Ability2 TEXT,
        HiddenAbility TEXT,
        EventAbilities TEXT,
        RecommendedRank TEXT NOT NULL,
        GenderType TEXT,
        Legendary INTEGER NOT NULL DEFAULT 0,
        GoodStarter INTEGER NOT NULL DEFAULT 0,
        DexCategory TEXT,
        HeightMeters REAL,
        HeightFeet REAL,
        WeightKg REAL,
        WeightLbs REAL,
        DexDescription TEXT,
        Image TEXT,
        BookImageName TEXT,
        BookShinyImageName TEXT,
        RawJSON TEXT NOT NULL
    );

    CREATE INDEX idx_pokedex_number ON pokedex(Number);
    CREATE INDEX idx_pokedex_dexid ON pokedex(DexID);
    CREATE INDEX idx_pokedex_name ON pokedex(Name);
    CREATE INDEX idx_pokedex_type1 ON pokedex(Type1);
    CREATE INDEX idx_pokedex_type2 ON pokedex(Type2);
    CREATE INDEX idx_pokedex_rank ON pokedex(RecommendedRank);
    CREATE INDEX idx_pokedex_starter ON pokedex(GoodStarter);
    CREATE INDEX idx_pokedex_legendary ON pokedex(Legendary);

    -- Pokedex Evolutions Table
    CREATE TABLE pokedex_evolutions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pokemon_id TEXT NOT NULL,
        ToPokemon TEXT,
        FromPokemon TEXT,
        Kind TEXT NOT NULL,
        Speed TEXT,
        Item TEXT,
        Stat TEXT,
        Value TEXT,
        Special TEXT,
        FOREIGN KEY (pokemon_id) REFERENCES pokedex(_id) ON DELETE CASCADE
    );

    CREATE INDEX idx_evolutions_pokemon_id ON pokedex_evolutions(pokemon_id);
    CREATE INDEX idx_evolutions_to ON pokedex_evolutions(ToPokemon);
    CREATE INDEX idx_evolutions_from ON pokedex_evolutions(FromPokemon);

    -- Pokedex Learnset Table
    CREATE TABLE pokedex_moves (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pokemon_id TEXT NOT NULL,
        Learned TEXT NOT NULL,
        Name TEXT NOT NULL,
        FOREIGN KEY (pokemon_id) REFERENCES pokedex(_id) ON DELETE CASCADE
    );

    CREATE INDEX idx_learnset_pokemon_id ON pokedex_moves(pokemon_id);
    CREATE INDEX idx_learnset_move_name ON pokedex_moves(Name);
    CREATE INDEX idx_learnset_rank ON pokedex_moves(Learned);

    -- Moves Table
    CREATE TABLE moves (
        _id TEXT PRIMARY KEY,
        Name TEXT NOT NULL,
        Type TEXT NOT NULL,
        Power TEXT NOT NULL DEFAULT '0',
        Damage1 TEXT,
        Damage2 TEXT,
        Accuracy1 TEXT,
        Accuracy2 TEXT,
        Target TEXT,
        Effect TEXT,
        Description TEXT,
        Category TEXT NOT NULL,
        Attributes TEXT,
        AddedEffects TEXT,
        RawJSON TEXT NOT NULL
    );

    CREATE INDEX idx_moves_name ON moves(Name);
    CREATE INDEX idx_moves_type ON moves(Type);
    CREATE INDEX idx_moves_category ON moves(Category);
    CREATE INDEX idx_moves_power ON moves(Power);

    -- Abilities Table
    CREATE TABLE abilities (
        _id TEXT PRIMARY KEY,
        Name TEXT NOT NULL,
        Effect TEXT,
        Description TEXT,
        RawJSON TEXT NOT NULL
    );

    CREATE INDEX idx_abilities_name ON abilities(Name);

    -- Natures Table
    CREATE TABLE natures (
        _id TEXT PRIMARY KEY,
        Name TEXT NOT NULL,
        Nature TEXT NOT NULL,
        Confidence INTEGER NOT NULL DEFAULT 0,
        Description TEXT,
        Keywords TEXT,
        RawJSON TEXT NOT NULL
    );

    CREATE INDEX idx_natures_name ON natures(Name);
    CREATE INDEX idx_natures_confidence ON natures(Confidence);

    -- Items Table
    CREATE TABLE items (
        _id TEXT PRIMARY KEY,
        Name TEXT NOT NULL,
        Source TEXT,
        Author TEXT,
        PMD INTEGER NOT NULL DEFAULT 0,
        Pocket TEXT NOT NULL,
        Category TEXT,
        Description TEXT,
        OneUse INTEGER NOT NULL DEFAULT 0,
        PMDPrice TEXT,
        TrainerPrice TEXT,
        ForTypes TEXT,
        ForPokemon TEXT,
        HealthRestored INTEGER,
        Cures TEXT,
        Boost TEXT,
        Value INTEGER,
        MaxMovePower INTEGER,
        Image TEXT,
        RawJSON TEXT NOT NULL
    );

    CREATE INDEX idx_items_name ON items(Name);
    CREATE INDEX idx_items_pocket ON items(Pocket);
    CREATE INDEX idx_items_category ON items(Category);
    CREATE INDEX idx_items_pmd ON items(PMD);
    """
    conn.executescript(schema_sql)
    conn.commit()

def import_pokedex(conn):
    pokedex_dir = os.path.join(STORAGE_DIR, "Pokedex")
    files = glob.glob(os.path.join(pokedex_dir, "*.json"))
    pokemon_rows = []
    evolution_rows = []
    move_rows = []

    for filepath in files:
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)

        _id = data.get("_id") or data.get("Name", "").lower().replace(" ", "-")
        height = data.get("Height") or {}
        weight = data.get("Weight") or {}

        pokemon_rows.append((
            _id,
            int(data.get("Number", 0)),
            str(data.get("DexID", "")),
            str(data.get("Name", "")),
            str(data.get("Type1", "")),
            data.get("Type2") if data.get("Type2") else None,
            int(data.get("BaseHP", 0)),
            int(data.get("Strength", 0)),
            int(data.get("MaxStrength", 0)),
            int(data.get("Dexterity", 0)),
            int(data.get("MaxDexterity", 0)),
            int(data.get("Vitality", 0)),
            int(data.get("MaxVitality", 0)),
            int(data.get("Special", 0)),
            int(data.get("MaxSpecial", 0)),
            int(data.get("Insight", 0)),
            int(data.get("MaxInsight", 0)),
            str(data.get("Ability1", "")),
            data.get("Ability2") if data.get("Ability2") else None,
            data.get("HiddenAbility") if data.get("HiddenAbility") else None,
            data.get("EventAbilities") if data.get("EventAbilities") else None,
            str(data.get("RecommendedRank", "")),
            data.get("GenderType") if data.get("GenderType") else None,
            1 if data.get("Legendary") else 0,
            1 if data.get("GoodStarter") else 0,
            str(data.get("DexCategory", "")),
            float(height.get("Meters", 0.0)) if isinstance(height, dict) and "Meters" in height else None,
            float(height.get("Feet", 0.0)) if isinstance(height, dict) and "Feet" in height else None,
            float(weight.get("Kilograms", 0.0)) if isinstance(weight, dict) and "Kilograms" in weight else None,
            float(weight.get("Pounds", 0.0)) if isinstance(weight, dict) and "Pounds" in weight else None,
            str(data.get("DexDescription", "")),
            str(data.get("Image", "")),
            data.get("BookImageName"),
            data.get("BookShinyImageName"),
            json.dumps(data, ensure_ascii=False)
        ))

        # Evolutions
        for evo in data.get("Evolutions", []):
            evolution_rows.append((
                _id,
                evo.get("To"),
                evo.get("From"),
                str(evo.get("Kind", "")),
                evo.get("Speed"),
                evo.get("Item"),
                evo.get("Stat"),
                str(evo.get("Value")) if evo.get("Value") is not None else None,
                evo.get("Special")
            ))

        # Moves (Learnset)
        for move in data.get("Moves", []):
            move_rows.append((
                _id,
                str(move.get("Learned", "")),
                str(move.get("Name", ""))
            ))

    conn.executemany("""
        INSERT INTO pokedex (
            _id, Number, DexID, Name, Type1, Type2, BaseHP,
            Strength, MaxStrength, Dexterity, MaxDexterity,
            Vitality, MaxVitality, Special, MaxSpecial,
            Insight, MaxInsight, Ability1, Ability2, HiddenAbility,
            EventAbilities, RecommendedRank, GenderType, Legendary,
            GoodStarter, DexCategory, HeightMeters, HeightFeet,
            WeightKg, WeightLbs, DexDescription, Image,
            BookImageName, BookShinyImageName, RawJSON
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?
        )
    """, pokemon_rows)

    conn.executemany("""
        INSERT INTO pokedex_evolutions (
            pokemon_id, ToPokemon, FromPokemon, Kind, Speed, Item, Stat, Value, Special
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, evolution_rows)

    conn.executemany("""
        INSERT INTO pokedex_moves (
            pokemon_id, Learned, Name
        ) VALUES (?, ?, ?)
    """, move_rows)

    conn.commit()
    print(f"Imported {len(pokemon_rows)} Pokemon, {len(evolution_rows)} Evolutions, {len(move_rows)} Learnset records.")

def import_moves(conn):
    moves_dir = os.path.join(STORAGE_DIR, "Moves")
    files = glob.glob(os.path.join(moves_dir, "*.json"))
    move_rows = []

    for filepath in files:
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)

        _id = data.get("_id") or data.get("Name", "").lower().replace(" ", "-")
        attrs = data.get("Attributes")
        added_effects = data.get("AddedEffects")

        move_rows.append((
            _id,
            str(data.get("Name", "")),
            str(data.get("Type", "")),
            str(data.get("Power", "0")),
            data.get("Damage1") if data.get("Damage1") else None,
            data.get("Damage2") if data.get("Damage2") else None,
            data.get("Accuracy1") if data.get("Accuracy1") else None,
            data.get("Accuracy2") if data.get("Accuracy2") else None,
            data.get("Target") if data.get("Target") else None,
            data.get("Effect") if data.get("Effect") else None,
            data.get("Description") if data.get("Description") else None,
            str(data.get("Category", "")),
            json.dumps(attrs, ensure_ascii=False) if attrs else None,
            json.dumps(added_effects, ensure_ascii=False) if added_effects else None,
            json.dumps(data, ensure_ascii=False)
        ))

    conn.executemany("""
        INSERT INTO moves (
            _id, Name, Type, Power, Damage1, Damage2,
            Accuracy1, Accuracy2, Target, Effect, Description,
            Category, Attributes, AddedEffects, RawJSON
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, move_rows)

    conn.commit()
    print(f"Imported {len(move_rows)} Moves.")

def import_abilities(conn):
    abilities_dir = os.path.join(STORAGE_DIR, "Abilities")
    files = glob.glob(os.path.join(abilities_dir, "*.json"))
    ability_rows = []

    for filepath in files:
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)

        _id = data.get("_id") or data.get("Name", "").lower().replace(" ", "-")
        ability_rows.append((
            _id,
            str(data.get("Name", "")),
            data.get("Effect") if data.get("Effect") else None,
            data.get("Description") if data.get("Description") else None,
            json.dumps(data, ensure_ascii=False)
        ))

    conn.executemany("""
        INSERT INTO abilities (
            _id, Name, Effect, Description, RawJSON
        ) VALUES (?, ?, ?, ?, ?)
    """, ability_rows)

    conn.commit()
    print(f"Imported {len(ability_rows)} Abilities.")

def import_natures(conn):
    natures_dir = os.path.join(STORAGE_DIR, "Natures")
    files = glob.glob(os.path.join(natures_dir, "*.json"))
    nature_rows = []

    for filepath in files:
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)

        _id = data.get("_id") or data.get("Name", "").lower().replace(" ", "-")
        nature_rows.append((
            _id,
            str(data.get("Name", "")),
            str(data.get("Nature", "")),
            int(data.get("Confidence", 0)),
            data.get("Description") if data.get("Description") else None,
            data.get("Keywords") if data.get("Keywords") else None,
            json.dumps(data, ensure_ascii=False)
        ))

    conn.executemany("""
        INSERT INTO natures (
            _id, Name, Nature, Confidence, Description, Keywords, RawJSON
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
    """, nature_rows)

    conn.commit()
    print(f"Imported {len(nature_rows)} Natures.")

def serialize_str_or_list(val):
    if val is None:
        return None
    if isinstance(val, list):
        return ", ".join(str(x) for x in val)
    return str(val)

def import_items(conn):
    items_dir = os.path.join(STORAGE_DIR, "Items")
    files = glob.glob(os.path.join(items_dir, "*.json"))
    item_rows = []

    for filepath in files:
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)

        _id = data.get("_id") or data.get("Name", "").lower().replace(" ", "-")
        val = data.get("Value")
        health = data.get("HealthRestored")
        max_power = data.get("MaxMovePower")

        item_rows.append((
            _id,
            str(data.get("Name", "")),
            data.get("Source"),
            data.get("Author"),
            1 if data.get("PMD") else 0,
            str(data.get("Pocket", "")),
            data.get("Category"),
            data.get("Description"),
            1 if data.get("OneUse") else 0,
            str(data.get("PMDPrice")) if data.get("PMDPrice") is not None else None,
            str(data.get("TrainerPrice")) if data.get("TrainerPrice") is not None else None,
            serialize_str_or_list(data.get("ForTypes")),
            serialize_str_or_list(data.get("ForPokemon")),
            int(health) if health is not None else None,
            serialize_str_or_list(data.get("Cures")),
            serialize_str_or_list(data.get("Boost")),
            int(val) if val is not None else None,
            int(max_power) if max_power is not None else None,
            data.get("Image"),
            json.dumps(data, ensure_ascii=False)
        ))

    conn.executemany("""
        INSERT INTO items (
            _id, Name, Source, Author, PMD, Pocket, Category,
            Description, OneUse, PMDPrice, TrainerPrice, ForTypes,
            ForPokemon, HealthRestored, Cures, Boost, Value,
            MaxMovePower, Image, RawJSON
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, item_rows)

    conn.commit()
    print(f"Imported {len(item_rows)} Items.")

def run_import():
    print(f"Connecting to database at: {DB_PATH}")
    conn = get_db_connection()
    print("Initializing SQLite schema according to DDL.md...")
    init_schema(conn)

    print("Importing Pokedex...")
    import_pokedex(conn)

    print("Importing Moves...")
    import_moves(conn)

    print("Importing Abilities...")
    import_abilities(conn)

    print("Importing Natures...")
    import_natures(conn)

    print("Importing Items...")
    import_items(conn)

    # Database quick verification
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM pokedex;")
    pokemons = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM pokedex_evolutions;")
    evos = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM pokedex_moves;")
    learnset = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM moves;")
    moves = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM abilities;")
    abilities = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM natures;")
    natures = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM items;")
    items = cursor.fetchone()[0]

    print("\n--- IMPORT SUMMARY ---")
    print(f"Pokemon:          {pokemons}")
    print(f"Evolutions:       {evos}")
    print(f"Learnset Moves:   {learnset}")
    print(f"Moves:            {moves}")
    print(f"Abilities:        {abilities}")
    print(f"Natures:          {natures}")
    print(f"Items:            {items}")
    print(f"Database size:    {os.path.getsize(DB_PATH) / (1024*1024):.2f} MB")
    print("Database import completed successfully!")
    conn.close()

if __name__ == "__main__":
    run_import()
