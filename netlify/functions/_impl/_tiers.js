// api/_tiers.js — disalin persis dari rpg.js (bot WA): weaponTiers, toolTiers, armorTiers
// Dipakai untuk hitung biaya .repair agar formula identik dengan bot.

const weaponTiers = [
	{ tier: 1, names: { sword: 'Rusty Broadsword', wand: 'Splintered Branch', dagger: 'Chipped Shiv', scythe: 'Dull Sickle', bow: 'Short Bow', catalyst: 'Empty Flask' }, reqLevel: 1, price: 0, bonusAtk: 5, maxDurability: 60, craftCost: { wood: 3 } },
	{ tier: 2, names: { sword: 'Crude Stone Sword', wand: 'Carved Stone Staff', dagger: 'Stone Kunai', scythe: 'Heavy Stone Scythe', bow: 'Stone-tipped Bow', catalyst: 'Stone Mortar' }, reqLevel: 5, price: 1500, bonusAtk: 12, maxDurability: 120, craftCost: { wood: 5, stone: 8 } },
	{ tier: 3, names: { sword: 'Refined Iron Longsword', wand: 'Iron-tipped Wand', dagger: 'Iron Stiletto', scythe: 'Iron Reaper', bow: 'Iron Longbow', catalyst: 'Iron Cauldron' }, reqLevel: 10, price: 5000, bonusAtk: 25, maxDurability: 250, craftCost: { stone: 10, iron: 5 } },
	{ tier: 4, names: { sword: 'Gilded Royal Blade', wand: 'Golden Sun Staff', dagger: 'Gold-plated Kris', scythe: 'Gilded Crescent', bow: 'Golden Recurve', catalyst: 'Golden Chalice' }, reqLevel: 20, price: 12000, bonusAtk: 45, maxDurability: 400, craftCost: { iron: 8, gold_ore: 5 } },
	{ tier: 5, names: { sword: 'Starlight Saber', wand: 'Crystal Core Wand', dagger: 'Starlight Dirk', scythe: 'Crystalline Scythe', bow: 'Starlight Bow', catalyst: 'Crystal Vial' }, reqLevel: 35, price: 30000, bonusAtk: 75, maxDurability: 600, craftCost: { gold_ore: 10, diamond: 3 } },
	{ tier: 6, names: { sword: 'Deep Sea Claymore', wand: 'Tidal Mythril Staff', dagger: 'Abyssal Tooth', scythe: 'Leviathan Sickle', bow: 'Mythril Striker', catalyst: 'Abyssal Flask' }, reqLevel: 50, price: 65000, bonusAtk: 120, maxDurability: 850, craftCost: { diamond: 5, mythril: 4 } },
	{ tier: 7, names: { sword: 'Ancient Relic Sword', wand: 'Forgotten Sage Staff', dagger: 'Relic Shadowblade', scythe: 'Ancient Harvester', bow: 'Ancient Whisper', catalyst: 'Forgotten Elixir' }, reqLevel: 75, price: 150000, bonusAtk: 180, maxDurability: 1200, craftCost: { mythril: 8, ancient_coin: 2 } },
	{ tier: 8, names: { sword: 'Volcanic Zweihander', wand: 'Magma Obsidian Rod', dagger: 'Ember Kris', scythe: 'Obsidian Cleaver', bow: 'Volcanic Arc', catalyst: 'Magma Vial' }, reqLevel: 100, price: 350000, bonusAtk: 260, maxDurability: 1800, craftCost: { obsidian_ore: 10, ancient_coin: 5 } },
	{ tier: 9, names: { sword: 'Dragon Fang Blade', wand: 'Wyrmbone Staff', dagger: 'Dragon Claw', scythe: 'Bone Reaper Scythe', bow: 'Dragonbone Bow', catalyst: 'Wyrmblood Flask' }, reqLevel: 150, price: 750000, bonusAtk: 400, maxDurability: 2500, craftCost: { gold_ore: 25, diamond: 15 } },
	{ tier: 10, names: { sword: 'Godforged Katana', wand: 'Divine Ice Scepter', dagger: 'Godslayer Tanto', scythe: 'Godforged Crescent', bow: 'Divine Piercer', catalyst: 'Godforged Catalyst' }, reqLevel: 200, price: 1500000, bonusAtk: 600, maxDurability: 3500, craftCost: { gold_ore: 50, ancient_ice: 2 } },
	
	{ tier: 11, names: { sword: 'Celestial Saber', wand: 'Astro-Core Wand', dagger: 'Comet Shard Dagger', scythe: 'Starfall Reaper', bow: 'Celestial Bow', catalyst: 'Astro Flask' }, reqLevel: 300, price: 3000000, bonusAtk: 900, maxDurability: 5000, craftCost: { gold_ore: 80, ancient_ice: 5 } },
	{ tier: 12, names: { sword: 'Voidbreaker Greatsword', wand: 'Staff of the Void', dagger: 'Null-Space Dirk', scythe: 'Void Eater Scythe', bow: 'Void Piercer', catalyst: 'Void Catalyst' }, reqLevel: 450, price: 6000000, bonusAtk: 1300, maxDurability: 7000, craftCost: { void_crystal: 2, mythril: 25 } },
	{ tier: 13, names: { sword: 'Astral Meteor Blade', wand: 'Galaxy Weaver Staff', dagger: 'Meteorite Kunai', scythe: 'Astral Cleaver', bow: 'Meteor Bow', catalyst: 'Astral Brew' }, reqLevel: 600, price: 12000000, bonusAtk: 1800, maxDurability: 9000, craftCost: { astral_shard: 3, void_crystal: 5 } },
	{ tier: 14, names: { sword: 'Chrono-Rift Blade', wand: 'Time Lord Scepter', dagger: 'Paradox Shiv', scythe: 'Chronos Sickle', bow: 'Chrono Bow', catalyst: 'Paradox Flask' }, reqLevel: 800, price: 20000000, bonusAtk: 2500, maxDurability: 12000, craftCost: { chrono_dust: 5, astral_shard: 8 } },
	{ tier: 15, names: { sword: 'Infinity Edge', wand: 'Matrix Infinity Wand', dagger: 'Infinite Pierce', scythe: 'Infinity Harvester', bow: 'Infinity Striker', catalyst: 'Matrix Catalyst' }, reqLevel: 1000, price: 35000000, bonusAtk: 3500, maxDurability: 18000, craftCost: { infinity_stone: 1, chrono_dust: 15 } },
	{ tier: 16, names: { sword: 'Transcendent Longsword', wand: 'Staff of Transcendence', dagger: 'Transcendent Fang', scythe: 'Soul Sever Scythe', bow: 'Transcendent Bow', catalyst: 'Soulbound Vial' }, reqLevel: 1300, price: 55000000, bonusAtk: 5000, maxDurability: 30000, craftCost: { infinity_stone: 3, god_soul: 1 } },
	{ tier: 17, names: { sword: 'Omni Genesis Blade', wand: 'Staff of Genesis', dagger: 'Omni-Stab Dagger', scythe: 'Genesis Reaper', bow: 'Genesis Bow', catalyst: 'Omni Flask' }, reqLevel: 1700, price: 85000000, bonusAtk: 7500, maxDurability: 45000, craftCost: { omni_core: 1, god_soul: 2 } },
	{ tier: 18, names: { sword: 'Yggdrasil Broadsword', wand: 'World Tree Branch', dagger: 'Nature’s Thorn', scythe: 'Yggdrasil Harvester', bow: 'Yggdrasil Bow', catalyst: 'Nature Catalyst' }, reqLevel: 2200, price: 130000000, bonusAtk: 11000, maxDurability: 70000, craftCost: { genesis_seed: 1, omni_core: 3 } },
	{ tier: 19, names: { sword: 'Abyssal Eternity Sword', wand: 'Staff of the Deep', dagger: 'Abyssal Needle', scythe: 'Eternity Scythe', bow: 'Abyssal Bow', catalyst: 'Eternity Brew' }, reqLevel: 2800, price: 180000000, bonusAtk: 16000, maxDurability: 95000, craftCost: { abyss_heart: 2, genesis_seed: 5 } },
	{ tier: 20, names: { sword: 'Sword of THE CREATOR', wand: 'Rod of THE CREATOR', dagger: 'Fang of THE CREATOR', scythe: 'Scythe of THE CREATOR', bow: 'Bow of THE CREATOR', catalyst: 'Catalyst of THE CREATOR' }, reqLevel: 3500, price: 300000000, bonusAtk: 25000, maxDurability: 999999, craftCost: { the_creator_spark: 1 } },
	
	{ tier: 21, names: { sword: 'Excalibur Phantom', wand: 'Phantom Magus Staff', dagger: 'Ghost-Step Dagger', scythe: 'Phantom Reaper', bow: 'Phantom Striker', catalyst: 'Excalibur Vial' }, reqLevel: 4500, price: 550000000, bonusAtk: 38000, maxDurability: 1500000, craftCost: { excalibur_fragment: 1, the_creator_spark: 2 } },
	{ tier: 22, names: { sword: 'Phoenix Ash Blade', wand: 'Staff of the Firebird', dagger: 'Phoenix Talon', scythe: 'Rebirth Scythe', bow: 'Phoenix Bow', catalyst: 'Ash Catalyst' }, reqLevel: 6000, price: 900000000, bonusAtk: 55000, maxDurability: 2000000, craftCost: { phoenix_ashes: 1, excalibur_fragment: 3 } },
	{ tier: 23, names: { sword: 'Dragon Fury Greatsword', wand: 'Draconic Roar Scepter', dagger: 'Wyrm’s Bite', scythe: 'Dragon Sever', bow: 'Dragon Fury Bow', catalyst: 'Draconic Flask' }, reqLevel: 8000, price: 1500000000, bonusAtk: 80000, maxDurability: 3000000, craftCost: { dragon_heart: 1, phoenix_ashes: 5 } },
	{ tier: 24, names: { sword: 'Demon Bane Excalibur', wand: 'Archdemon Skull Wand', dagger: 'Demonic Kris', scythe: 'Hellish Reaper', bow: 'Demon Bane Bow', catalyst: 'Hellish Vial' }, reqLevel: 10500, price: 2500000000, bonusAtk: 120000, maxDurability: 4500000, craftCost: { demon_lord_horn: 1, dragon_heart: 6 } },
	{ tier: 25, names: { sword: 'World Breaker Sword', wand: 'Earth-shatter Staff', dagger: 'Tectonic Shiv', scythe: 'Planet Cleaver', bow: 'World Breaker Bow', catalyst: 'Tectonic Catalyst' }, reqLevel: 13500, price: 4500000000, bonusAtk: 180000, maxDurability: 6000000, craftCost: { world_tree_root: 1, demon_lord_horn: 8 } },
	{ tier: 26, names: { sword: 'Dark Orbit Saber', wand: 'Black Hole Scepter', dagger: 'Event Horizon Dagger', scythe: 'Orbit Harvester', bow: 'Dark Orbit Bow', catalyst: 'Black Hole Flask' }, reqLevel: 17000, price: 8000000000, bonusAtk: 260000, maxDurability: 8500000, craftCost: { dark_orbit_core: 2, world_tree_root: 10 } },
	{ tier: 27, names: { sword: 'Titan Cleaver', wand: 'Colossal Magic Wand', dagger: 'Titan’s Needle', scythe: 'Titan Sickle', bow: 'Titan Bow', catalyst: 'Colossal Brew' }, reqLevel: 21500, price: 12000000000, bonusAtk: 380000, maxDurability: 12000000, craftCost: { titan_blood: 2, dark_orbit_core: 15 } },
	{ tier: 28, names: { sword: 'Celestial Sunblade', wand: 'Staff of the Heavens', dagger: 'Heavenly Kunai', scythe: 'Celestial Sever', bow: 'Heavens Bow', catalyst: 'Celestial Catalyst' }, reqLevel: 27000, price: 20000000000, bonusAtk: 550000, maxDurability: 16000000, craftCost: { celestial_tear: 2, titan_blood: 20 } },
	{ tier: 29, names: { sword: 'Nebula Slicer', wand: 'Cosmic Dust Wand', dagger: 'Nebula Shard', scythe: 'Galaxy Reaper', bow: 'Nebula Bow', catalyst: 'Cosmic Flask' }, reqLevel: 34000, price: 35000000000, bonusAtk: 800000, maxDurability: 22000000, craftCost: { nebulium_ingot: 2, celestial_tear: 30 } },
	{ tier: 30, names: { sword: 'Pandora’s Edge', wand: 'Cursed Box Scepter', dagger: 'Pandora’s Kiss', scythe: 'Box of Demise Scythe', bow: 'Pandora’s Bow', catalyst: 'Pandora’s Flask' }, reqLevel: 42000, price: 55000000000, bonusAtk: 1200000, maxDurability: 30000000, craftCost: { pandora_box: 1, nebulium_ingot: 40 } },
	
	{ tier: 31, names: { sword: 'Galactic Arbiter Sword', wand: 'Arbiter’s Will', dagger: 'Galactic Shiv', scythe: 'Arbiter Scythe', bow: 'Galactic Bow', catalyst: 'Arbiter Catalyst' }, reqLevel: 52000, price: 85000000000, bonusAtk: 1800000, maxDurability: 40000000, craftCost: { pandora_box: 2, the_creator_spark: 15 } },
	{ tier: 32, names: { sword: 'Supernova Longsword', wand: 'Exploding Star Wand', dagger: 'Supernova Dirk', scythe: 'Nova Reaper', bow: 'Supernova Bow', catalyst: 'Nova Vial' }, reqLevel: 64000, price: 120000000000, bonusAtk: 2600000, maxDurability: 55000000, craftCost: { pandora_box: 3, excalibur_fragment: 30 } },
	{ tier: 33, names: { sword: 'Cosmic Singularity Blade', wand: 'Singularity Staff', dagger: 'Black Dwarf Dagger', scythe: 'Singularity Scythe', bow: 'Singularity Bow', catalyst: 'Singularity Flask' }, reqLevel: 78000, price: 180000000000, bonusAtk: 3800000, maxDurability: 75000000, craftCost: { pandora_box: 5, phoenix_ashes: 50 } },
	{ tier: 34, names: { sword: 'Event Horizon Katana', wand: 'Wand of the Horizon', dagger: 'Horizon Fang', scythe: 'Event Horizon Cleaver', bow: 'Horizon Bow', catalyst: 'Horizon Catalyst' }, reqLevel: 95000, price: 280000000000, bonusAtk: 5500000, maxDurability: 100000000, craftCost: { pandora_box: 8, dragon_heart: 70 } },
	{ tier: 35, names: { sword: 'Dimension Ripper', wand: 'Rift-Maker Staff', dagger: 'Dimension Tear', scythe: 'Dimensional Sickle', bow: 'Dimension Bow', catalyst: 'Rift Flask' }, reqLevel: 115000, price: 420000000000, bonusAtk: 8000000, maxDurability: 135000000, craftCost: { pandora_box: 12, demon_lord_horn: 90 } },
	{ tier: 36, names: { sword: 'Reality Weaver Sword', wand: 'Reality Manipulator', dagger: 'Reality Pierce', scythe: 'Reality Harvester', bow: 'Reality Bow', catalyst: 'Reality Flask' }, reqLevel: 140000, price: 650000000000, bonusAtk: 12000000, maxDurability: 180000000, craftCost: { pandora_box: 18, world_tree_root: 110 } },
	{ tier: 37, names: { sword: 'Time Paradox Claymore', wand: 'Paradox Spellstaff', dagger: 'Time-Skip Kunai', scythe: 'Time-Eater Scythe', bow: 'Paradox Bow', catalyst: 'Time Catalyst' }, reqLevel: 170000, price: 950000000000, bonusAtk: 18000000, maxDurability: 240000000, craftCost: { pandora_box: 25, dark_orbit_core: 130 } },
	{ tier: 38, names: { sword: 'Quantum Eraser', wand: 'Quantum Core Wand', dagger: 'Eraser Dagger', scythe: 'Quantum Cleaver', bow: 'Quantum Bow', catalyst: 'Eraser Catalyst' }, reqLevel: 210000, price: 1350000000000, bonusAtk: 26000000, maxDurability: 320000000, craftCost: { pandora_box: 35, titan_blood: 150 } },
	{ tier: 39, names: { sword: 'Aetherial Dawn Blade', wand: 'Aether Dawn Scepter', dagger: 'Aether Fang', scythe: 'Aetherial Reaper', bow: 'Aetherial Bow', catalyst: 'Dawn Flask' }, reqLevel: 260000, price: 1900000000000, bonusAtk: 38000000, maxDurability: 420000000, craftCost: { pandora_box: 50, celestial_tear: 180 } },
	{ tier: 40, names: { sword: 'Primordial Light Sword', wand: 'Primordial Ray Wand', dagger: 'Primordial Dirk', scythe: 'Primordial Sickle', bow: 'Primordial Bow', catalyst: 'Primordial Catalyst' }, reqLevel: 320000, price: 2800000000000, bonusAtk: 55000000, maxDurability: 550000000, craftCost: { pandora_box: 70, nebulium_ingot: 220 } },
	
	{ tier: 41, names: { sword: 'Chaos Theory Blade', wand: 'Chaos Manipulator', dagger: 'Chaos Tooth', scythe: 'Chaos Harvester', bow: 'Chaos Bow', catalyst: 'Chaos Flask' }, reqLevel: 390000, price: 4200000000000, bonusAtk: 80000000, maxDurability: 700000000, craftCost: { pandora_box: 100, titan_blood: 300 } },
	{ tier: 42, names: { sword: 'Absolute Zero Katana', wand: 'Sub-Zero Scepter', dagger: 'Zero-Kelvin Kunai', scythe: 'Absolute Zero Scythe', bow: 'Absolute Zero Bow', catalyst: 'Sub-Zero Catalyst' }, reqLevel: 480000, price: 6500000000000, bonusAtk: 120000000, maxDurability: 900000000, craftCost: { pandora_box: 150, celestial_tear: 400 } },
	{ tier: 43, names: { sword: 'Entropy Greatsword', wand: 'Staff of Entropy', dagger: 'Entropy Shiv', scythe: 'Entropy Cleaver', bow: 'Entropy Bow', catalyst: 'Entropy Brew' }, reqLevel: 590000, price: 9500000000000, bonusAtk: 180000000, maxDurability: 1200000000, craftCost: { pandora_box: 200, nebulium_ingot: 500 } },
	{ tier: 44, names: { sword: 'Universal Law Blade', wand: 'Wand of The Law', dagger: 'Law-Breaker Dagger', scythe: 'Universal Reaper', bow: 'Universal Bow', catalyst: 'Law Catalyst' }, reqLevel: 720000, price: 13500000000000, bonusAtk: 260000000, maxDurability: 1600000000, craftCost: { pandora_box: 300, the_creator_spark: 700 } },
	{ tier: 45, names: { sword: 'Multiversal Ruler Saber', wand: 'Multiverse Scepter', dagger: 'Multiversal Fang', scythe: 'Multiversal Harvester', bow: 'Multiversal Bow', catalyst: 'Multiversal Flask' }, reqLevel: 880000, price: 20000000000000, bonusAtk: 380000000, maxDurability: 2200000000, craftCost: { pandora_box: 450, excalibur_fragment: 900 } },
	{ tier: 46, names: { sword: 'The Zenith Sword', wand: 'Zenith Oracle Wand', dagger: 'Zenith Strike', scythe: 'Zenith Scythe', bow: 'Zenith Bow', catalyst: 'Zenith Catalyst' }, reqLevel: 1080000, price: 30000000000000, bonusAtk: 550000000, maxDurability: 3000000000, craftCost: { pandora_box: 600, phoenix_ashes: 1200 } },
	{ tier: 47, names: { sword: 'Apex Predator Katana', wand: 'Apex Arcane Rod', dagger: 'Apex Predator Claw', scythe: 'Apex Sever', bow: 'Apex Bow', catalyst: 'Apex Flask' }, reqLevel: 1320000, price: 45000000000000, bonusAtk: 800000000, maxDurability: 4200000000, craftCost: { pandora_box: 800, dragon_heart: 1500 } },
	{ tier: 48, names: { sword: 'Omniscient Blade', wand: 'Omniscient Staff', dagger: 'Omniscient Pierce', scythe: 'Omniscient Cleaver', bow: 'Omniscient Bow', catalyst: 'Omniscient Brew' }, reqLevel: 1600000, price: 65000000000000, bonusAtk: 1200000000, maxDurability: 5800000000, craftCost: { pandora_box: 1200, demon_lord_horn: 2000 } },
	{ tier: 49, names: { sword: 'Alpha & Omega Sword', wand: 'Alpha & Omega Scepter', dagger: 'Alpha & Omega Kris', scythe: 'Alpha & Omega Sickle', bow: 'Alpha & Omega Bow', catalyst: 'Alpha & Omega Flask' }, reqLevel: 1950000, price: 95000000000000, bonusAtk: 1800000000, maxDurability: 8000000000, craftCost: { pandora_box: 1800, celestial_tear: 3000 } },
	{ tier: 50, names: { sword: 'Sword of THE OMNIPOTENT', wand: 'Staff of THE OMNIPOTENT', dagger: 'Dagger of THE OMNIPOTENT', scythe: 'Scythe of THE OMNIPOTENT', bow: 'Bow of THE OMNIPOTENT', catalyst: 'Flask of THE OMNIPOTENT' }, reqLevel: 2500000, price: 150000000000000, bonusAtk: 3000000000, maxDurability: 10000000000, craftCost: { pandora_box: 3000, god_soul: 5000 } }
];

const toolTiers = [
	{ 
		tier: 1, 
		names: { pickaxe: 'Rusty Pickaxe', axe: 'Stone-chipped Axe', fishing_rod: 'Old Fishing Rod', hoe: 'Rusty Hoe' }, 
		reqLevel: 1, price: 0, bonusPower: 5, maxDurability: 60, craftCost: { wood: 3 } 
	},
	{ 
		tier: 2, 
		names: { pickaxe: 'Crude Stone Pick', axe: 'Heavy Flint Axe', fishing_rod: 'Bamboo Rod', hoe: 'Stone Hoe' }, 
		reqLevel: 5, price: 1500, bonusPower: 12, maxDurability: 120, craftCost: { wood: 5, stone: 8 } 
	},
	{ 
		tier: 3, 
		names: { pickaxe: 'Refined Iron Pick', axe: 'Polished Iron Axe', fishing_rod: 'Iron-reinforced Rod', hoe: 'Iron Hoe' }, 
		reqLevel: 10, price: 5000, bonusPower: 25, maxDurability: 250, craftCost: { stone: 10, iron: 5 } 
	},
	{ 
		tier: 4, 
		names: { pickaxe: 'Gilded Golden Pick', axe: 'Royal Golden Axe', fishing_rod: 'Golden Thread Rod', hoe: 'Gilded Hoe' }, 
		reqLevel: 20, price: 12000, bonusPower: 45, maxDurability: 400, craftCost: { iron: 8, gold_ore: 5 } 
	},
	{ 
		tier: 5, 
		names: { pickaxe: 'Starlight Drill', axe: 'Crystal Edge Axe', fishing_rod: 'Luminous Line Rod', hoe: 'Crystal-tipped Hoe' }, 
		reqLevel: 35, price: 30000, bonusPower: 75, maxDurability: 600, craftCost: { gold_ore: 10, diamond: 3 } 
	},
	{ 
		tier: 6, 
		names: { pickaxe: 'Mythril Breaker', axe: 'Tidal Mythril Axe', fishing_rod: 'Abyssal Reel', hoe: 'Mythril Plow' }, 
		reqLevel: 50, price: 65000, bonusPower: 120, maxDurability: 850, craftCost: { diamond: 5, mythril: 4 } 
	},
	{ 
		tier: 7, 
		names: { pickaxe: 'Relic Earthshaker', axe: 'Ancient Carver', fishing_rod: 'Forgotten Hook', hoe: 'Ancient Tiller' }, 
		reqLevel: 75, price: 150000, bonusPower: 180, maxDurability: 1200, craftCost: { mythril: 8, ancient_coin: 2 } 
	},
	{ 
		tier: 8, 
		names: { pickaxe: 'Volcanic Magma Pick', axe: 'Obsidian Splitter', fishing_rod: 'Lava-proof Rod', hoe: 'Magma Cultivator' }, 
		reqLevel: 100, price: 350000, bonusPower: 260, maxDurability: 1800, craftCost: { obsidian_ore: 10, ancient_coin: 5 } 
	},
	{ 
		tier: 9, 
		names: { pickaxe: 'Dragon Fang Pick', axe: 'Wyrmbone Hatchet', fishing_rod: 'Dragon Scale Line', hoe: 'Dragon Talon Hoe' }, 
		reqLevel: 150, price: 750000, bonusPower: 400, maxDurability: 2500, craftCost: { gold_ore: 25, diamond: 15 } 
	},
	{ 
		tier: 10, 
		names: { pickaxe: 'Divine Ice Pick', axe: 'Godforged Cleaver', fishing_rod: 'Heavenly Angler', hoe: 'Divine Earth-molder' }, 
		reqLevel: 200, price: 1500000, bonusPower: 600, maxDurability: 3500, craftCost: { gold_ore: 50, ancient_ice: 2 } 
	},
	{ 
		tier: 11, 
		names: { pickaxe: 'Celestial Star-Drill', axe: 'Comet Shard Axe', fishing_rod: 'Astro-Fiber Rod', hoe: 'Celestial Hoe' }, 
		reqLevel: 300, price: 3000000, bonusPower: 900, maxDurability: 5000, craftCost: { gold_ore: 80, ancient_ice: 5 } 
	},
	{ 
		tier: 12, 
		names: { pickaxe: 'Void-Touched Pick', axe: 'Null-Space Axe', fishing_rod: 'Rift-Catcher Rod', hoe: 'Void Plow' }, 
		reqLevel: 450, price: 6000000, bonusPower: 1300, maxDurability: 7000, craftCost: { void_crystal: 2, mythril: 25 } 
	},
	{ 
		tier: 13, 
		names: { pickaxe: 'Astral Meteor Crusher', axe: 'Galaxy Splitter', fishing_rod: 'Meteor-Hook Rod', hoe: 'Astral Tiller' }, 
		reqLevel: 600, price: 12000000, bonusPower: 1800, maxDurability: 9000, craftCost: { astral_shard: 3, void_crystal: 5 } 
	},
	{ 
		tier: 14, 
		names: { pickaxe: 'Chrono-Time Miner', axe: 'Paradox Axe', fishing_rod: 'Time-Lord Reel', hoe: 'Timeline Hoe' }, 
		reqLevel: 800, price: 20000000, bonusPower: 2500, maxDurability: 12000, craftCost: { chrono_dust: 5, astral_shard: 8 } 
	},
	{ 
		tier: 15, 
		names: { pickaxe: 'Infinity Matrix Drill', axe: 'Infinite Edge Axe', fishing_rod: 'Eternal Angler', hoe: 'Matrix Cultivator' }, 
		reqLevel: 1000, price: 35000000, bonusPower: 3500, maxDurability: 18000, craftCost: { infinity_stone: 1, chrono_dust: 15 } 
	},
	{ 
		tier: 16, 
		names: { pickaxe: 'Transcendent Breaker', axe: 'Soul-Bound Axe', fishing_rod: 'God-Seeker Rod', hoe: 'Transcendent Plow' }, 
		reqLevel: 1300, price: 55000000, bonusPower: 5000, maxDurability: 30000, craftCost: { infinity_stone: 3, god_soul: 1 } 
	},
	{ 
		tier: 17, 
		names: { pickaxe: 'Omni Resonator Drill', axe: 'Staff-Forged Axe', fishing_rod: 'Omni-Reel Angler', hoe: 'Omni Hoe' }, 
		reqLevel: 1700, price: 85000000, bonusPower: 7500, maxDurability: 45000, craftCost: { omni_core: 1, god_soul: 2 } 
	},
	{ 
		tier: 18, 
		names: { pickaxe: 'Yggdrasil Root Pick', axe: 'World-Tree Hatchet', fishing_rod: 'Nature’s Vine Rod', hoe: 'Gaia Hoe' }, 
		reqLevel: 2200, price: 130000000, bonusPower: 11000, maxDurability: 70000, craftCost: { genesis_seed: 1, omni_core: 3 } 
	},
	{ 
		tier: 19, 
		names: { pickaxe: 'Abyssal Depth Miner', axe: 'Eternity Splitter', fishing_rod: 'Leviathan Hook', hoe: 'Abyssal Cultivator' }, 
		reqLevel: 2800, price: 180000000, bonusPower: 16000, maxDurability: 95000, craftCost: { abyss_heart: 2, genesis_seed: 5 } 
	},
	{ 
		tier: 20, 
		names: { pickaxe: 'THE ARCHITECT', axe: 'THE WORLD-SHAPER', fishing_rod: 'THE SOUL-CATCHER', hoe: 'THE EARTH-MOLDER' }, 
		reqLevel: 3500, price: 300000000, bonusPower: 25000, maxDurability: 999999, craftCost: { the_creator_spark: 1 } 
	},
	{ 
		tier: 21, 
		names: { pickaxe: 'Phantom Core Drill', axe: 'Ghost-Edge Axe', fishing_rod: 'Spectral Rod', hoe: 'Phantom Hoe' }, 
		reqLevel: 4500, price: 550000000, bonusPower: 38000, maxDurability: 1500000, craftCost: { excalibur_fragment: 1, the_creator_spark: 2 } 
	},
	{ 
		tier: 22, 
		names: { pickaxe: 'Phoenix Wing Pick', axe: 'Ash-Forged Axe', fishing_rod: 'Rebirth Rod', hoe: 'Phoenix Hoe' }, 
		reqLevel: 6000, price: 900000000, bonusPower: 55000, maxDurability: 2000000, craftCost: { phoenix_ashes: 1, excalibur_fragment: 3 } 
	},
	{ 
		tier: 23, 
		names: { pickaxe: 'Dragon’s Fury Drill', axe: 'Draconic Axe', fishing_rod: 'Wyrm’s Tail Rod', hoe: 'Dragon-Scale Hoe' }, 
		reqLevel: 8000, price: 1500000000, bonusPower: 80000, maxDurability: 3000000, craftCost: { dragon_heart: 1, phoenix_ashes: 5 } 
	},
	{ 
		tier: 24, 
		names: { pickaxe: 'Demon Claw Pick', axe: 'Hell-Raiser Axe', fishing_rod: 'Demonic Angler', hoe: 'Hellish Plow' }, 
		reqLevel: 10500, price: 2500000000, bonusPower: 120000, maxDurability: 4500000, craftCost: { demon_lord_horn: 1, dragon_heart: 6 } 
	},
	{ 
		tier: 25, 
		names: { pickaxe: 'World Breaker Drill', axe: 'Tectonic Axe', fishing_rod: 'Gravity Rod', hoe: 'World-Canopy Hoe' }, 
		reqLevel: 13500, price: 4500000000, bonusPower: 180000, maxDurability: 6000000, craftCost: { world_tree_root: 1, demon_lord_horn: 8 } 
	},
	{ 
		tier: 26, 
		names: { pickaxe: 'Orbit-Shatter Pick', axe: 'Black-Hole Axe', fishing_rod: 'Event-Horizon Rod', hoe: 'Orbit Bastion Hoe' }, 
		reqLevel: 17000, price: 8000000000, bonusPower: 260000, maxDurability: 8500000, craftCost: { dark_orbit_core: 2, world_tree_root: 10 } 
	},
	{ 
		tier: 27, 
		names: { pickaxe: 'Titan Cleaver Pick', axe: 'Colossal Magic Axe', fishing_rod: 'Titan’s Needle Rod', hoe: 'Colossal Tiller' }, 
		reqLevel: 21500, price: 12000000000, bonusPower: 380000, maxDurability: 12000000, craftCost: { titan_blood: 2, dark_orbit_core: 15 } 
	},
	{ 
		tier: 28, 
		names: { pickaxe: 'Celestial Sun-Pick', axe: 'Heavens Forge Axe', fishing_rod: 'Celestial Angler', hoe: 'Sun-Bleached Hoe' }, 
		reqLevel: 27000, price: 20000000000, bonusPower: 550000, maxDurability: 16000000, craftCost: { celestial_tear: 2, titan_blood: 20 } 
	},
	{ 
		tier: 29, 
		names: { pickaxe: 'Nebula Slicer Pick', axe: 'Cosmic Dust Axe', fishing_rod: 'Galaxy Harvester', hoe: 'Nebula Hoe' }, 
		reqLevel: 34000, price: 35000000000, bonusPower: 800000, maxDurability: 22000000, craftCost: { nebulium_ingot: 2, celestial_tear: 30 } 
	},
	{ 
		tier: 30, 
		names: { pickaxe: 'Pandora’s Spike', axe: 'Box of Demise Axe', fishing_rod: 'Pandora’s Lure', hoe: 'Pandora’s Hoe' }, 
		reqLevel: 42000, price: 55000000000, bonusPower: 1200000, maxDurability: 30000000, craftCost: { pandora_box: 1, nebulium_ingot: 40 } 
	},
	{ 
		tier: 31, 
		names: { pickaxe: 'Galactic Arbiter Pick', axe: 'Will of Arbiter Axe', fishing_rod: 'Star-Tuner Rod', hoe: 'Galactic Hoe' }, 
		reqLevel: 52000, price: 85000000000, bonusPower: 1800000, maxDurability: 40000000, craftCost: { pandora_box: 2, the_creator_spark: 15 } 
	},
	{ 
		tier: 32, 
		names: { pickaxe: 'Supernova Drill', axe: 'Exploding Star Axe', fishing_rod: 'Nova-Line Angler', hoe: 'Supernova Hoe' }, 
		reqLevel: 64000, price: 120000000000, bonusPower: 2600000, maxDurability: 55000000, craftCost: { pandora_box: 3, excalibur_fragment: 30 } 
	},
	{ 
		tier: 33, 
		names: { pickaxe: 'Cosmic Singularity Pick', axe: 'Black Dwarf Axe', fishing_rod: 'Singularity Hook', hoe: 'Cosmic Hoe' }, 
		reqLevel: 78000, price: 180000000000, bonusPower: 3800000, maxDurability: 75000000, craftCost: { pandora_box: 5, phoenix_ashes: 50 } 
	},
	{ 
		tier: 34, 
		names: { pickaxe: 'Event Horizon Pick', axe: 'Katana-Edge Axe', fishing_rod: 'Horizon Maker Rod', hoe: 'Horizon Hoe' }, 
		reqLevel: 95000, price: 280000000000, bonusPower: 5500000, maxDurability: 100000000, craftCost: { pandora_box: 8, dragon_heart: 70 } 
	},
	{ 
		tier: 35, 
		names: { pickaxe: 'Dimension Ripper Pick', axe: 'Dimensional Sickle Axe', fishing_rod: 'Rift Carver Angler', hoe: 'Dimensional Hoe' }, 
		reqLevel: 115000, price: 420000000000, bonusPower: 8000000, maxDurability: 135000000, craftCost: { pandora_box: 12, demon_lord_horn: 90 } 
	},
	{ 
		tier: 36, 
		names: { pickaxe: 'Reality Weaver Pick', axe: 'Reality Pierce Axe', fishing_rod: 'Molder Rod', hoe: 'Reality Hoe' }, 
		reqLevel: 140000, price: 650000000000, bonusPower: 12000000, maxDurability: 180000000, craftCost: { pandora_box: 18, world_tree_root: 110 } 
	},
	{ 
		tier: 37, 
		names: { pickaxe: 'Time Paradox Pick', axe: 'Time-Eater Axe', fishing_rod: 'Paradox Reel', hoe: 'Paradox Hoe' }, 
		reqLevel: 170000, price: 950000000000, bonusPower: 18000000, maxDurability: 240000000, craftCost: { pandora_box: 25, dark_orbit_core: 130 } 
	},
	{ 
		tier: 38, 
		names: { pickaxe: 'Quantum Eraser Pick', axe: 'Eraser-Edge Axe', fishing_rod: 'Decoder Rod', hoe: 'Quantum Hoe' }, 
		reqLevel: 210000, price: 1350000000000, bonusPower: 26000000, maxDurability: 320000000, craftCost: { pandora_box: 35, titan_blood: 150 } 
	},
	{ 
		tier: 39, 
		names: { pickaxe: 'Aetherial Dawn Pick', axe: 'Aether Edge Axe', fishing_rod: 'Aetherial Catalyst Rod', hoe: 'Dawn Hoe' }, 
		reqLevel: 260000, price: 1900000000000, bonusPower: 38000000, maxDurability: 420000000, craftCost: { pandora_box: 50, celestial_tear: 180 } 
	},
	{ 
		tier: 40, 
		names: { pickaxe: 'Primordial Light Pick', axe: 'Primordial Edge Axe', fishing_rod: 'Primordial Spark Rod', hoe: 'Light Hoe' }, 
		reqLevel: 320000, price: 2800000000000, bonusPower: 55000000, maxDurability: 550000000, craftCost: { pandora_box: 70, nebulium_ingot: 220 } 
	},
	{ 
		tier: 41, 
		names: { pickaxe: 'Chaos Theory Pick', axe: 'Chaos Cleaver', fishing_rod: 'Chaos Engine Rod', hoe: 'Chaos Hoe' }, 
		reqLevel: 390000, price: 4200000000000, bonusPower: 80000000, maxDurability: 700000000, craftCost: { pandora_box: 100, titan_blood: 300 } 
	},
	{ 
		tier: 42, 
		names: { pickaxe: 'Absolute Zero Pick', axe: 'Sub-Zero Hatchet', fishing_rod: 'Absolute Core Rod', hoe: 'Zero Hoe' }, 
		reqLevel: 480000, price: 6500000000000, bonusPower: 120000000, maxDurability: 900000000, craftCost: { pandora_box: 150, celestial_tear: 400 } 
	},
	{ 
		tier: 43, 
		names: { pickaxe: 'Entropy Great-Pick', axe: 'Entropy Axe', fishing_rod: 'Entropy Forger Rod', hoe: 'Entropy Hoe' }, 
		reqLevel: 590000, price: 9500000000000, bonusPower: 180000000, maxDurability: 1200000000, craftCost: { pandora_box: 200, nebulium_ingot: 500 } 
	},
	{ 
		tier: 44, 
		names: { pickaxe: 'Universal Law Pick', axe: 'Law-Edge Axe', fishing_rod: 'Universal Compass Rod', hoe: 'Law Hoe' }, 
		reqLevel: 720000, price: 13500000000000, bonusPower: 260000000, maxDurability: 1600000000, craftCost: { pandora_box: 300, the_creator_spark: 700 } 
	},
	{ 
		tier: 45, 
		names: { pickaxe: 'Multiversal Ruler Pick', axe: 'Multiverse Axe', fishing_rod: 'Multiversal Atlas Rod', hoe: 'Ruler Hoe' }, 
		reqLevel: 880000, price: 20000000000000, bonusPower: 380000000, maxDurability: 2200000000, craftCost: { pandora_box: 450, excalibur_fragment: 900 } 
	},
	{ 
		tier: 46, 
		names: { pickaxe: 'The Zenith Pick', axe: 'Zenith Oracle Axe', fishing_rod: 'Zenith Crafter Rod', hoe: 'Zenith Hoe' }, 
		reqLevel: 1080000, price: 30000000000000, bonusPower: 550000000, maxDurability: 3000000000, craftCost: { pandora_box: 600, phoenix_ashes: 1200 } 
	},
	{ 
		tier: 47, 
		names: { pickaxe: 'Apex Predator Pick', axe: 'Apex Predator Axe', fishing_rod: 'Apex Harvester Rod', hoe: 'Apex Hoe' }, 
		reqLevel: 1320000, price: 45000000000000, bonusPower: 800000000, maxDurability: 4200000000, craftCost: { pandora_box: 800, dragon_heart: 1500 } 
	},
	{ 
		tier: 48, 
		names: { pickaxe: 'Omniscient Eye Pick', axe: 'Omniscient Cleaver', fishing_rod: 'Omniscient Eye Rod', hoe: 'All-Seeing Hoe' }, 
		reqLevel: 1600000, price: 65000000000000, bonusPower: 1200000000, maxDurability: 5800000000, craftCost: { pandora_box: 1200, demon_lord_horn: 2000 } 
	},
	{ 
		tier: 49, 
		names: { pickaxe: 'Alpha & Omega Pick', axe: 'Alpha & Omega Axe', fishing_rod: 'Alpha & Omega Core Rod', hoe: 'Omega Hoe' }, 
		reqLevel: 1950000, price: 95000000000000, bonusPower: 1800000000, maxDurability: 8000000000, craftCost: { pandora_box: 1800, celestial_tear: 3000 } 
	},
	{ 
		tier: 50, 
		names: { pickaxe: 'THE OMNIPOTENT PICK', axe: 'THE OMNIPOTENT AXE', fishing_rod: 'THE OMNIPOTENT ROD', hoe: 'THE OMNIPOTENT HOE' }, 
		reqLevel: 2500000, price: 150000000000000, bonusPower: 3000000000, maxDurability: 10000000000, craftCost: { pandora_box: 3000, god_soul: 5000 } 
	}
];


const armorTiers = [
	{
		tier: 1,
		names: { helmet: 'Leather Cap', chestplate: 'Leather Tunic', leggings: 'Leather Pants', boots: 'Leather Boots' },
		reqLevel: 1, price: 0, bonusDef: 1, maxDurability: 60, craftCost: { leather: 5 }
	},
	{
		tier: 2,
		names: { helmet: 'Flint Helm', chestplate: 'Flint Chestplate', leggings: 'Flint Greaves', boots: 'Flint Boots' },
		reqLevel: 5, price: 1500, bonusDef: 4, maxDurability: 120, craftCost: { leather: 8, stone: 5 }
	},
	{
		tier: 3,
		names: { helmet: 'Iron Helm', chestplate: 'Iron Armor', leggings: 'Iron Leggings', boots: 'Iron Boots' },
		reqLevel: 10, price: 5000, bonusDef: 8, maxDurability: 250, craftCost: { stone: 10, iron: 5 }
	},
	{
		tier: 4,
		names: { helmet: 'Golden Crown', chestplate: 'Golden Chestplate', leggings: 'Golden Greaves', boots: 'Golden Boots' },
		reqLevel: 20, price: 12000, bonusDef: 15, maxDurability: 400, craftCost: { iron: 8, gold_ore: 5 }
	},
	{
		tier: 5,
		names: { helmet: 'Crystal Helm', chestplate: 'Crystal Chestplate', leggings: 'Crystal Leggings', boots: 'Crystal Boots' },
		reqLevel: 35, price: 30000, bonusDef: 25, maxDurability: 600, craftCost: { gold_ore: 10, diamond: 3 }
	},
	{
		tier: 6,
		names: { helmet: 'Mythril Helm', chestplate: 'Mythril Chestplate', leggings: 'Mythril Leggings', boots: 'Mythril Boots' },
		reqLevel: 50, price: 65000, bonusDef: 40, maxDurability: 850, craftCost: { diamond: 5, mythril: 4 }
	},
	{
		tier: 7,
		names: { helmet: 'Ancient Helm', chestplate: 'Ancient Chestplate', leggings: 'Ancient Leggings', boots: 'Ancient Boots' },
		reqLevel: 75, price: 150000, bonusDef: 60, maxDurability: 1200, craftCost: { mythril: 8, ancient_coin: 2 }
	},
	{
		tier: 8,
		names: { helmet: 'Obsidian Helm', chestplate: 'Obsidian Chestplate', leggings: 'Obsidian Leggings', boots: 'Obsidian Boots' },
		reqLevel: 100, price: 350000, bonusDef: 86, maxDurability: 1800, craftCost: { obsidian_ore: 10, ancient_coin: 5 }
	},
	{
		tier: 9,
		names: { helmet: 'Dragon Scale Helm', chestplate: 'Dragon Scale Chestplate', leggings: 'Dragon Scale Leggings', boots: 'Dragon Scale Boots' },
		reqLevel: 150, price: 750000, bonusDef: 133, maxDurability: 2500, craftCost: { gold_ore: 25, diamond: 15 }
	},
	{
		tier: 10,
		names: { helmet: 'Divine Helm', chestplate: 'Divine Chestplate', leggings: 'Divine Leggings', boots: 'Divine Boots' },
		reqLevel: 200, price: 1500000, bonusDef: 200, maxDurability: 3500, craftCost: { gold_ore: 50, ancient_ice: 2 }
	},
	{
		tier: 11,
		names: { helmet: 'Celestial Helm', chestplate: 'Celestial Chestplate', leggings: 'Celestial Leggings', boots: 'Celestial Boots' },
		reqLevel: 300, price: 3000000, bonusDef: 300, maxDurability: 5000, craftCost: { gold_ore: 80, ancient_ice: 5 }
	},
	{
		tier: 12,
		names: { helmet: 'Void Helm', chestplate: 'Void Chestplate', leggings: 'Void Leggings', boots: 'Void Boots' },
		reqLevel: 450, price: 6000000, bonusDef: 433, maxDurability: 7000, craftCost: { void_crystal: 2, mythril: 25 }
	},
	{
		tier: 13,
		names: { helmet: 'Astral Helm', chestplate: 'Astral Chestplate', leggings: 'Astral Leggings', boots: 'Astral Boots' },
		reqLevel: 600, price: 12000000, bonusDef: 600, maxDurability: 9000, craftCost: { astral_shard: 3, void_crystal: 5 }
	},
	{
		tier: 14,
		names: { helmet: 'Chrono Helm', chestplate: 'Chrono Chestplate', leggings: 'Chrono Leggings', boots: 'Chrono Boots' },
		reqLevel: 800, price: 20000000, bonusDef: 833, maxDurability: 12000, craftCost: { chrono_dust: 5, astral_shard: 8 }
	},
	{
		tier: 15,
		names: { helmet: 'Infinity Helm', chestplate: 'Infinity Chestplate', leggings: 'Infinity Leggings', boots: 'Infinity Boots' },
		reqLevel: 1000, price: 35000000, bonusDef: 1166, maxDurability: 18000, craftCost: { infinity_stone: 1, chrono_dust: 15 }
	},
	{
		tier: 16,
		names: { helmet: 'Transcendent Helm', chestplate: 'Transcendent Chestplate', leggings: 'Transcendent Leggings', boots: 'Transcendent Boots' },
		reqLevel: 1300, price: 55000000, bonusDef: 1666, maxDurability: 30000, craftCost: { infinity_stone: 3, god_soul: 1 }
	},
	{
		tier: 17,
		names: { helmet: 'Omni Helm', chestplate: 'Omni Chestplate', leggings: 'Omni Leggings', boots: 'Omni Boots' },
		reqLevel: 1700, price: 85000000, bonusDef: 2500, maxDurability: 45000, craftCost: { omni_core: 1, god_soul: 2 }
	},
	{
		tier: 18,
		names: { helmet: 'Gaia Helm', chestplate: 'Gaia Chestplate', leggings: 'Gaia Leggings', boots: 'Gaia Boots' },
		reqLevel: 2200, price: 130000000, bonusDef: 3666, maxDurability: 70000, craftCost: { genesis_seed: 1, omni_core: 3 }
	},
	{
		tier: 19,
		names: { helmet: 'Abyssal Helm', chestplate: 'Abyssal Chestplate', leggings: 'Abyssal Leggings', boots: 'Abyssal Boots' },
		reqLevel: 2800, price: 180000000, bonusDef: 5333, maxDurability: 95000, craftCost: { abyss_heart: 2, genesis_seed: 5 }
	},
	{
		tier: 20,
		names: { helmet: 'HELM OF THE ARCHITECT', chestplate: 'ARMOR OF THE ARCHITECT', leggings: 'LEGGINGS OF THE ARCHITECT', boots: 'BOOTS OF THE ARCHITECT' },
		reqLevel: 3500, price: 300000000, bonusDef: 8333, maxDurability: 999999, craftCost: { the_creator_spark: 1 }
	},
	{
		tier: 21,
		names: { helmet: 'Phantom Helm', chestplate: 'Phantom Chestplate', leggings: 'Phantom Leggings', boots: 'Phantom Boots' },
		reqLevel: 4500, price: 550000000, bonusDef: 12666, maxDurability: 1500000, craftCost: { excalibur_fragment: 1, the_creator_spark: 2 }
	},
	{
		tier: 22,
		names: { helmet: 'Phoenix Helm', chestplate: 'Phoenix Chestplate', leggings: 'Phoenix Leggings', boots: 'Phoenix Boots' },
		reqLevel: 6000, price: 900000000, bonusDef: 18333, maxDurability: 2000000, craftCost: { phoenix_ashes: 1, excalibur_fragment: 3 }
	},
	{
		tier: 23,
		names: { helmet: 'Draconic Helm', chestplate: 'Draconic Chestplate', leggings: 'Draconic Leggings', boots: 'Draconic Boots' },
		reqLevel: 8000, price: 1500000000, bonusDef: 26666, maxDurability: 3000000, craftCost: { dragon_heart: 1, phoenix_ashes: 5 }
	},
	{
		tier: 24,
		names: { helmet: 'Demonic Helm', chestplate: 'Demonic Chestplate', leggings: 'Demonic Leggings', boots: 'Demonic Boots' },
		reqLevel: 10500, price: 2500000000, bonusDef: 40000, maxDurability: 4500000, craftCost: { demon_lord_horn: 1, dragon_heart: 6 }
	},
	{
		tier: 25,
		names: { helmet: 'Tectonic Helm', chestplate: 'Tectonic Chestplate', leggings: 'Tectonic Leggings', boots: 'Tectonic Boots' },
		reqLevel: 13500, price: 4500000000, bonusDef: 60000, maxDurability: 6000000, craftCost: { world_tree_root: 1, demon_lord_horn: 8 }
	},
	{
		tier: 26,
		names: { helmet: 'Orbit Helm', chestplate: 'Orbit Chestplate', leggings: 'Orbit Leggings', boots: 'Orbit Boots' },
		reqLevel: 17000, price: 8000000000, bonusDef: 86666, maxDurability: 8500000, craftCost: { dark_orbit_core: 2, world_tree_root: 10 }
	},
	{
		tier: 27,
		names: { helmet: 'Titan Helm', chestplate: 'Titan Chestplate', leggings: 'Titan Leggings', boots: 'Titan Boots' },
		reqLevel: 21500, price: 12000000000, bonusDef: 126666, maxDurability: 12000000, craftCost: { titan_blood: 2, dark_orbit_core: 15 }
	},
	{
		tier: 28,
		names: { helmet: 'Sun-Forged Helm', chestplate: 'Sun-Forged Chestplate', leggings: 'Sun-Forged Leggings', boots: 'Sun-Forged Boots' },
		reqLevel: 27000, price: 20000000000, bonusDef: 183333, maxDurability: 16000000, craftCost: { celestial_tear: 2, titan_blood: 20 }
	},
	{
		tier: 29,
		names: { helmet: 'Nebula Helm', chestplate: 'Nebula Chestplate', leggings: 'Nebula Leggings', boots: 'Nebula Boots' },
		reqLevel: 34000, price: 35000000000, bonusDef: 266666, maxDurability: 22000000, craftCost: { nebulium_ingot: 2, celestial_tear: 30 }
	},
	{
		tier: 30,
		names: { helmet: 'Pandora\'s Helm', chestplate: 'Pandora\'s Chestplate', leggings: 'Pandora\'s Leggings', boots: 'Pandora\'s Boots' },
		reqLevel: 42000, price: 55000000000, bonusDef: 400000, maxDurability: 30000000, craftCost: { pandora_box: 1, nebulium_ingot: 40 }
	},
	{
		tier: 31,
		names: { helmet: 'Galactic Helm', chestplate: 'Galactic Chestplate', leggings: 'Galactic Leggings', boots: 'Galactic Boots' },
		reqLevel: 52000, price: 85000000000, bonusDef: 600000, maxDurability: 40000000, craftCost: { pandora_box: 2, the_creator_spark: 15 }
	},
	{
		tier: 32,
		names: { helmet: 'Supernova Helm', chestplate: 'Supernova Chestplate', leggings: 'Supernova Leggings', boots: 'Supernova Boots' },
		reqLevel: 64000, price: 120000000000, bonusDef: 866666, maxDurability: 55000000, craftCost: { pandora_box: 3, excalibur_fragment: 30 }
	},
	{
		tier: 33,
		names: { helmet: 'Singularity Helm', chestplate: 'Singularity Chestplate', leggings: 'Singularity Leggings', boots: 'Singularity Boots' },
		reqLevel: 78000, price: 180000000000, bonusDef: 1266666, maxDurability: 75000000, craftCost: { pandora_box: 5, phoenix_ashes: 50 }
	},
	{
		tier: 34,
		names: { helmet: 'Event Horizon Helm', chestplate: 'Event Horizon Chestplate', leggings: 'Event Horizon Leggings', boots: 'Event Horizon Boots' },
		reqLevel: 95000, price: 280000000000, bonusDef: 1833333, maxDurability: 100000000, craftCost: { pandora_box: 8, dragon_heart: 70 }
	},
	{
		tier: 35,
		names: { helmet: 'Dimensional Helm', chestplate: 'Dimensional Chestplate', leggings: 'Dimensional Leggings', boots: 'Dimensional Boots' },
		reqLevel: 115000, price: 420000000000, bonusDef: 2666666, maxDurability: 135000000, craftCost: { pandora_box: 12, demon_lord_horn: 90 }
	},
	{
		tier: 36,
		names: { helmet: 'Reality Helm', chestplate: 'Reality Chestplate', leggings: 'Reality Leggings', boots: 'Reality Boots' },
		reqLevel: 140000, price: 650000000000, bonusDef: 4000000, maxDurability: 180000000, craftCost: { pandora_box: 18, world_tree_root: 110 }
	},
	{
		tier: 37,
		names: { helmet: 'Paradox Helm', chestplate: 'Paradox Chestplate', leggings: 'Paradox Leggings', boots: 'Paradox Boots' },
		reqLevel: 170000, price: 950000000000, bonusDef: 6000000, maxDurability: 240000000, craftCost: { pandora_box: 25, dark_orbit_core: 130 }
	},
	{
		tier: 38,
		names: { helmet: 'Quantum Helm', chestplate: 'Quantum Chestplate', leggings: 'Quantum Leggings', boots: 'Quantum Boots' },
		reqLevel: 210000, price: 1350000000000, bonusDef: 8666666, maxDurability: 320000000, craftCost: { pandora_box: 35, titan_blood: 150 }
	},
	{
		tier: 39,
		names: { helmet: 'Aetherial Helm', chestplate: 'Aetherial Chestplate', leggings: 'Aetherial Leggings', boots: 'Aetherial Boots' },
		reqLevel: 260000, price: 1900000000000, bonusDef: 12666666, maxDurability: 420000000, craftCost: { pandora_box: 50, celestial_tear: 180 }
	},
	{
		tier: 40,
		names: { helmet: 'Primordial Helm', chestplate: 'Primordial Chestplate', leggings: 'Primordial Leggings', boots: 'Primordial Boots' },
		reqLevel: 320000, price: 2800000000000, bonusDef: 18333333, maxDurability: 550000000, craftCost: { pandora_box: 70, nebulium_ingot: 220 }
	},
	{
		tier: 41,
		names: { helmet: 'Chaos Helm', chestplate: 'Chaos Chestplate', leggings: 'Chaos Leggings', boots: 'Chaos Boots' },
		reqLevel: 390000, price: 4200000000000, bonusDef: 26666666, maxDurability: 700000000, craftCost: { pandora_box: 100, titan_blood: 300 }
	},
	{
		tier: 42,
		names: { helmet: 'Absolute Zero Helm', chestplate: 'Absolute Zero Chestplate', leggings: 'Absolute Zero Leggings', boots: 'Absolute Zero Boots' },
		reqLevel: 480000, price: 6500000000000, bonusDef: 40000000, maxDurability: 900000000, craftCost: { pandora_box: 150, celestial_tear: 400 }
	},
	{
		tier: 43,
		names: { helmet: 'Entropy Helm', chestplate: 'Entropy Chestplate', leggings: 'Entropy Leggings', boots: 'Entropy Boots' },
		reqLevel: 590000, price: 9500000000000, bonusDef: 60000000, maxDurability: 1200000000, craftCost: { pandora_box: 200, nebulium_ingot: 500 }
	},
	{
		tier: 44,
		names: { helmet: 'Universal Law Helm', chestplate: 'Universal Law Chestplate', leggings: 'Universal Law Leggings', boots: 'Universal Law Boots' },
		reqLevel: 720000, price: 13500000000000, bonusDef: 86666666, maxDurability: 1600000000, craftCost: { pandora_box: 300, the_creator_spark: 700 }
	},
	{
		tier: 45,
		names: { helmet: 'Multiversal Helm', chestplate: 'Multiversal Chestplate', leggings: 'Multiversal Leggings', boots: 'Multiversal Boots' },
		reqLevel: 880000, price: 20000000000000, bonusDef: 126666666, maxDurability: 2200000000, craftCost: { pandora_box: 450, excalibur_fragment: 900 }
	},
	{
		tier: 46,
		names: { helmet: 'Zenith Helm', chestplate: 'Zenith Chestplate', leggings: 'Zenith Leggings', boots: 'Zenith Boots' },
		reqLevel: 1080000, price: 30000000000000, bonusDef: 183333333, maxDurability: 3000000000, craftCost: { pandora_box: 600, phoenix_ashes: 1200 }
	},
	{
		tier: 47,
		names: { helmet: 'Apex Helm', chestplate: 'Apex Chestplate', leggings: 'Apex Leggings', boots: 'Apex Boots' },
		reqLevel: 1320000, price: 45000000000000, bonusDef: 266666666, maxDurability: 4200000000, craftCost: { pandora_box: 800, dragon_heart: 1500 }
	},
	{
		tier: 48,
		names: { helmet: 'Omniscient Helm', chestplate: 'Omniscient Chestplate', leggings: 'Omniscient Leggings', boots: 'Omniscient Boots' },
		reqLevel: 1600000, price: 65000000000000, bonusDef: 400000000, maxDurability: 5800000000, craftCost: { pandora_box: 1200, demon_lord_horn: 2000 }
	},
	{
		tier: 49,
		names: { helmet: 'Omega Helm', chestplate: 'Omega Chestplate', leggings: 'Omega Leggings', boots: 'Omega Boots' },
		reqLevel: 1950000, price: 95000000000000, bonusDef: 600000000, maxDurability: 8000000000, craftCost: { pandora_box: 1800, celestial_tear: 3000 }
	},
	{
		tier: 50,
		names: { helmet: 'THE OMNIPOTENT HELM', chestplate: 'THE OMNIPOTENT CHESTPLATE', leggings: 'THE OMNIPOTENT LEGGINGS', boots: 'THE OMNIPOTENT BOOTS' },
		reqLevel: 2500000, price: 150000000000000, bonusDef: 1000000000, maxDurability: 10000000000, craftCost: { pandora_box: 3000, god_soul: 5000 }
	}
];

module.exports = { weaponTiers, toolTiers, armorTiers };
