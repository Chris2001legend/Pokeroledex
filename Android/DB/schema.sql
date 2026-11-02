-- Pokérole SQLite Database Schema (v3.0)
-- Conforms to DDL.md specifications

PRAGMA foreign_keys = ON;

-- Pokedex Table
CREATE TABLE IF NOT EXISTS pokedex (
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

CREATE INDEX IF NOT EXISTS idx_pokedex_number ON pokedex(Number);
CREATE INDEX IF NOT EXISTS idx_pokedex_dexid ON pokedex(DexID);
CREATE INDEX IF NOT EXISTS idx_pokedex_name ON pokedex(Name);
CREATE INDEX IF NOT EXISTS idx_pokedex_type1 ON pokedex(Type1);
CREATE INDEX IF NOT EXISTS idx_pokedex_type2 ON pokedex(Type2);
CREATE INDEX IF NOT EXISTS idx_pokedex_rank ON pokedex(RecommendedRank);
CREATE INDEX IF NOT EXISTS idx_pokedex_starter ON pokedex(GoodStarter);
CREATE INDEX IF NOT EXISTS idx_pokedex_legendary ON pokedex(Legendary);

-- Pokedex Evolutions Table
CREATE TABLE IF NOT EXISTS pokedex_evolutions (
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

CREATE INDEX IF NOT EXISTS idx_evolutions_pokemon_id ON pokedex_evolutions(pokemon_id);
CREATE INDEX IF NOT EXISTS idx_evolutions_to ON pokedex_evolutions(ToPokemon);
CREATE INDEX IF NOT EXISTS idx_evolutions_from ON pokedex_evolutions(FromPokemon);

-- Pokedex Learnset Table
CREATE TABLE IF NOT EXISTS pokedex_moves (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pokemon_id TEXT NOT NULL,
    Learned TEXT NOT NULL,
    Name TEXT NOT NULL,
    FOREIGN KEY (pokemon_id) REFERENCES pokedex(_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_learnset_pokemon_id ON pokedex_moves(pokemon_id);
CREATE INDEX IF NOT EXISTS idx_learnset_move_name ON pokedex_moves(Name);
CREATE INDEX IF NOT EXISTS idx_learnset_rank ON pokedex_moves(Learned);

-- Moves Table
CREATE TABLE IF NOT EXISTS moves (
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

CREATE INDEX IF NOT EXISTS idx_moves_name ON moves(Name);
CREATE INDEX IF NOT EXISTS idx_moves_type ON moves(Type);
CREATE INDEX IF NOT EXISTS idx_moves_category ON moves(Category);
CREATE INDEX IF NOT EXISTS idx_moves_power ON moves(Power);

-- Abilities Table
CREATE TABLE IF NOT EXISTS abilities (
    _id TEXT PRIMARY KEY,
    Name TEXT NOT NULL,
    Effect TEXT,
    Description TEXT,
    RawJSON TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_abilities_name ON abilities(Name);

-- Natures Table
CREATE TABLE IF NOT EXISTS natures (
    _id TEXT PRIMARY KEY,
    Name TEXT NOT NULL,
    Nature TEXT NOT NULL,
    Confidence INTEGER NOT NULL DEFAULT 0,
    Description TEXT,
    Keywords TEXT,
    RawJSON TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_natures_name ON natures(Name);
CREATE INDEX IF NOT EXISTS idx_natures_confidence ON natures(Confidence);

-- Items Table
CREATE TABLE IF NOT EXISTS items (
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

CREATE INDEX IF NOT EXISTS idx_items_name ON items(Name);
CREATE INDEX IF NOT EXISTS idx_items_pocket ON items(Pocket);
CREATE INDEX IF NOT EXISTS idx_items_category ON items(Category);
CREATE INDEX IF NOT EXISTS idx_items_pmd ON items(PMD);

-- Trainers Table (Pokérole Character Sheets)
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

CREATE INDEX IF NOT EXISTS idx_trainers_name ON trainers(name);

-- Custom Pokémon Table (Pokérole Pokémon Team & Custom Sheets)
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

CREATE INDEX IF NOT EXISTS idx_custom_pokemon_trainer ON custom_pokemon(trainer_id);
CREATE INDEX IF NOT EXISTS idx_custom_pokemon_species ON custom_pokemon(species_id);

