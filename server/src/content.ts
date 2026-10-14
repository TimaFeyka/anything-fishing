/**
 * ANYTHING FISHING — игровой контент: предметы, локации, снаряжение, рецепты.
 * Всё описано данными, чтобы сервер и клиент использовали один источник правды.
 * Никаких фотографий: у каждого предмета есть art-шаблон и палитра для SVG.
 */

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic' | 'secret';
export type Category = 'fish' | 'junk' | 'treasure' | 'tech' | 'fantasy' | 'giant';
export type ArtKind =
  | 'fish' | 'fishlong' | 'fishflat' | 'fishround' | 'jelly' | 'serpent' | 'kraken' | 'turtle' | 'ghost'
  | 'bottle' | 'can' | 'boot' | 'tire' | 'phone' | 'headphones' | 'watch' | 'gamepad' | 'console' | 'tv'
  | 'pc' | 'bike' | 'suitcase' | 'vending' | 'washer' | 'microwave' | 'toaster' | 'vacuum' | 'guitar'
  | 'umbrella' | 'pot' | 'shovel' | 'canister' | 'plate' | 'key' | 'coin' | 'ingot' | 'gem' | 'pearl'
  | 'crown' | 'mask' | 'chest' | 'map' | 'relic' | 'part' | 'chain' | 'cup' | 'casket' | 'drone' | 'robot'
  | 'camera' | 'engine' | 'propeller' | 'sonar' | 'device' | 'battery' | 'satellite' | 'blackbox'
  | 'container' | 'crystal' | 'orb' | 'portalpart' | 'rod' | 'sphere' | 'disk' | 'liquid' | 'echo'
  | 'safe' | 'anchor' | 'shipwreck' | 'wreckpart' | 'statue' | 'ark' | 'heart' | 'voidkey';
export type Palette = [string, string];
export type Pattern = 'none' | 'spots' | 'stripes' | 'scale' | 'glow' | 'rust' | 'gold' | 'glass' | 'circuit' | 'rune';

export interface ItemDef {
  id: string;
  name: string;
  cat: Category;
  rarity: Rarity;
  price: number;              // базовая цена в монетах (до модификаторов)
  w: [number, number];        // вес в граммах
  len: [number, number];      // длина в см
  pull: number;               // сила сопротивления при вываживании (1 = обычная рыба)
  art: ArtKind;
  pal: Palette;
  pat?: Pattern;
  desc: string;
  loc: string[];              // где встречается
  cast?: CastType[];          // предпочтительные типы заброса (пусто = любые)
  salvage?: [string, number][];
  serial?: number;            // ограниченный тираж на весь сервер (undefined = обычный)
  circulate?: boolean;        // участвует в механике «Возврат в пучину»
  unique?: boolean;           // уникальное свойство/способность
  ability?: string;
  chain?: string;             // id цепочки находок
  researchable?: boolean;
  tags?: string[];
}

export type CastType = 'normal' | 'far' | 'precise' | 'deep';

export const CAST_TYPES: Record<CastType, { name: string; icon: string; desc: string; rarityBias: number; catBias: Partial<Record<Category, number>>; depth: number }> = {
  normal: { name: 'Обычный', icon: '🎣', desc: 'Универсальный заброс у берега. Быстро, без сюрпризов.', rarityBias: 1, catBias: {}, depth: 0 },
  far: { name: 'Дальний', icon: '🌊', desc: 'Дальний заброс: больше техники и крупных предметов, вываживание дольше.', rarityBias: 1.15, catBias: { tech: 1.6, giant: 1.35, junk: 1.2 }, depth: 1 },
  precise: { name: 'Точный', icon: '🎯', desc: 'Точный заброс в перспективную зону: выше шанс редких находок и серийных предметов.', rarityBias: 1.5, catBias: { treasure: 1.8, fantasy: 1.5 }, depth: 1 },
  deep: { name: 'Глубоководный', icon: '🕳️', desc: 'Заброс на глубину: мифические существа и обломки, максимальная нагрузка на снасть.', rarityBias: 1.9, catBias: { giant: 2.2, fantasy: 1.8, fish: 1.2 }, depth: 3 },
};

export const RARITY: Record<Rarity, { name: string; color: string; glow: string; mult: number; order: number; sellableNpc: boolean }> = {
  common: { name: 'Обычная', color: '#9aa7b4', glow: '#5b6672', mult: 1, order: 1, sellableNpc: true },
  uncommon: { name: 'Необычная', color: '#5fd68a', glow: '#2c7a4c', mult: 1.15, order: 2, sellableNpc: true },
  rare: { name: 'Редкая', color: '#57a8ff', glow: '#1e4d8a', mult: 1.35, order: 3, sellableNpc: true },
  epic: { name: 'Эпическая', color: '#b46bff', glow: '#5b2a94', mult: 1.7, order: 4, sellableNpc: false },
  legendary: { name: 'Легендарная', color: '#ffb038', glow: '#8a5a10', mult: 2.2, order: 5, sellableNpc: false },
  mythic: { name: 'Мифическая', color: '#ff5f6d', glow: '#8a1f2a', mult: 3, order: 6, sellableNpc: false },
  secret: { name: 'Секретная', color: '#00ffd5', glow: '#0a6b5c', mult: 4.5, order: 7, sellableNpc: false },
};

export const CATEGORY_NAMES: Record<Category, string> = {
  fish: 'Рыбы и существа',
  junk: 'Мусор и бытовые предметы',
  treasure: 'Сокровища и артефакты',
  tech: 'Техника и механизмы',
  fantasy: 'Фантастические объекты',
  giant: 'Огромные и мифические находки',
};

const I = (
  id: string, name: string, cat: Category, rarity: Rarity, price: number,
  w: [number, number], len: [number, number], pull: number, art: ArtKind, pal: Palette,
  desc: string, opt: Partial<ItemDef> = {},
): ItemDef => ({ id, name, cat, rarity, price, w, len, pull, art, pal, desc, loc: [], ...opt });

// ─────────────────────────────── РЫБЫ И СУЩЕСТВА ───────────────────────────────
const FISH: ItemDef[] = [
  I('fish_roach', 'Плотва', 'fish', 'common', 12, [80, 400], [12, 26], 0.5, 'fishflat', ['#9fb6c9', '#e7eef5'], 'Серебристая рыбка, которую ловят все и всегда.', { loc: ['lake', 'harbor', 'ice'], salvage: [['mat_meat', 1]] }),
  I('fish_perch', 'Окунь', 'fish', 'common', 16, [120, 700], [15, 32], 0.7, 'fish', ['#4f7a3a', '#d95f2b'], 'Полосатый окунь. Гордый и колючий.', { loc: ['lake', 'harbor', 'ice'], pat: 'stripes', salvage: [['mat_meat', 1]] }),
  I('fish_crucian', 'Карась', 'fish', 'common', 14, [150, 1200], [16, 38], 0.8, 'fishround', ['#c2a24a', '#6f5a22'], 'Золотистый карась из илистых ям.', { loc: ['lake'], pat: 'scale', salvage: [['mat_meat', 1]] }),
  I('fish_bleak', 'Уклейка', 'fish', 'common', 8, [20, 90], [8, 16], 0.3, 'fishflat', ['#bcd3e0', '#f4f8fb'], 'Мелкая верховодка. Наживка для сома.', { loc: ['lake', 'harbor', 'ocean'], salvage: [['mat_meat', 1]] }),
  I('fish_gudgeon', 'Пескарь', 'fish', 'common', 9, [30, 120], [9, 18], 0.4, 'fishlong', ['#a3a06a', '#5d5a33'], 'Донная рыбка, вечно копается в песке.', { loc: ['lake', 'harbor'] }),
  I('fish_ruff', 'Ёрш', 'fish', 'common', 11, [40, 200], [10, 20], 0.45, 'fish', ['#7d8a95', '#3d464e'], 'Колючий ёрш с глазами навыкате.', { loc: ['lake', 'ice'] }),
  I('fish_rudd', 'Краснопёрка', 'fish', 'common', 15, [90, 600], [14, 30], 0.6, 'fishflat', ['#d98a4b', '#f0d9b5'], 'Ярко-красные плавники, скромный характер.', { loc: ['lake'] }),
  I('fish_tench', 'Линь', 'fish', 'common', 22, [200, 1500], [20, 42], 1.0, 'fishround', ['#4c6b3d', '#c9b25e'], 'Слизистый обитатель тёплых заливов.', { loc: ['lake'] }),
  I('fish_rotan', 'Ротан', 'fish', 'common', 18, [60, 400], [12, 25], 0.5, 'fishround', ['#3b3b3f', '#8a7a4a'], 'Хищник из пруда, которым пугают детей.', { loc: ['lake', 'ice'] }),
  I('fish_ide', 'Язь', 'fish', 'uncommon', 70, [400, 2500], [25, 60], 1.3, 'fish', ['#b9a878', '#6b5b2f'], 'Красивый сильный язь.', { loc: ['lake', 'harbor'] }),
  I('fish_bream', 'Лещ', 'fish', 'uncommon', 85, [500, 3000], [28, 62], 1.4, 'fishflat', ['#c9b98c', '#7d6c46'], 'Широкий как тарелка.', { loc: ['lake', 'harbor'] }),
  I('fish_pike', 'Щука', 'fish', 'uncommon', 120, [700, 6000], [40, 110], 1.6, 'fishlong', ['#3f5c34', '#c9d06a'], 'Зубастая хищница зарослей.', { loc: ['lake', 'harbor', 'ice'], pat: 'spots' }),
  I('fish_zander', 'Судак', 'fish', 'uncommon', 140, [800, 5000], [45, 95], 1.5, 'fish', ['#8fa3b0', '#33414d'], 'Клыкастый судак с ледяным взглядом.', { loc: ['lake', 'harbor'] }),
  I('fish_catfish', 'Сом', 'fish', 'uncommon', 190, [1500, 12000], [60, 140], 1.8, 'fishlong', ['#4a4038', '#a89880'], 'Усатый сом со дна. Пока ещё не гигант.', { loc: ['lake', 'harbor'] }),
  I('fish_carp', 'Карп', 'fish', 'uncommon', 160, [1200, 9000], [40, 90], 1.7, 'fishround', ['#a8823a', '#e0c477'], 'Сильный и осторожный карп.', { loc: ['lake'], pat: 'scale' }),
  I('fish_burbot', 'Налим', 'fish', 'uncommon', 150, [700, 4000], [40, 85], 1.4, 'fishlong', ['#5b5033', '#c9b06a'], 'Ночной хищник холодных ям.', { loc: ['lake', 'ice'] }),
  I('fish_asp', 'Жерех', 'fish', 'uncommon', 175, [900, 4000], [45, 80], 1.7, 'fish', ['#b9c2c9', '#4d5a66'], 'Бьёт малька на струе как молот.', { loc: ['harbor', 'lake'] }),
  I('fish_trout', 'Форель', 'fish', 'rare', 380, [600, 4500], [35, 75], 1.9, 'fish', ['#c98a5b', '#f2e2c9'], 'Пятнистая форель ледяной воды.', { loc: ['ice', 'lake'], pat: 'spots' }),
  I('fish_grayling', 'Хариус', 'fish', 'rare', 420, [400, 2200], [28, 58], 1.8, 'fish', ['#6f7fa8', '#d9c2a0'], 'Парусник среди речных рыб.', { loc: ['ice'] }),
  I('fish_sturgeon', 'Осётр', 'fish', 'rare', 620, [3000, 20000], [80, 190], 2.4, 'fishlong', ['#5a6b6f', '#c2c9c9'], 'Древняя рыба в костяных пластинах.', { loc: ['harbor', 'abyss'], pat: 'scale' }),
  I('fish_taimen', 'Таймень', 'fish', 'rare', 700, [4000, 25000], [90, 180], 2.6, 'fishlong', ['#7a4f3a', '#e3b07a'], 'Речной тигр, ломающий снасти.', { loc: ['ice', 'lake'] }),
  I('fish_moray', 'Мурена', 'fish', 'rare', 520, [2000, 12000], [70, 200], 2.2, 'fishlong', ['#3f5c3a', '#b8d06a'], 'Змеиное тело с зубами в два ряда.', { loc: ['ocean', 'sunken'] }),
  I('fish_ray', 'Скат', 'fish', 'rare', 560, [1500, 14000], [50, 130], 2.3, 'fishflat', ['#57677d', '#b9c9d9'], 'Плоский хищник, скользящий по дну.', { loc: ['ocean', 'harbor'] }),
  I('fish_piranha', 'Пиранья', 'fish', 'rare', 640, [500, 3000], [25, 45], 2.0, 'fishround', ['#8a2f2f', '#e0b06a'], 'Стайная рыба с бритвенными зубами.', { loc: ['ocean'], pat: 'spots' }),
  I('fish_eel', 'Электрический угорь', 'fish', 'epic', 1900, [3000, 18000], [80, 220], 2.8, 'serpent', ['#2f4f4f', '#a8ff7a'], 'Бьёт током прямо через леску.', { loc: ['ocean', 'abyss'], ability: 'Электроразряд: резко повышает натяжение при рывке.', unique: true }),
  I('fish_angler', 'Удильщик', 'fish', 'epic', 2100, [1200, 9000], [35, 90], 2.6, 'fishround', ['#22262b', '#8affc9'], 'Фонарик на удочке-отростке светит сквозь тьму.', { loc: ['abyss'], pat: 'glow', ability: 'Светится в темноте: подсвечивает силуэты рядом.' }),
  I('fish_ghost_carp', 'Золотой карп', 'fish', 'epic', 2600, [2000, 12000], [45, 95], 2.5, 'fishround', ['#d9a520', '#fff2b0'], 'Чешуя отливает золотом даже в мутной воде.', { loc: ['lake', 'sunken'], pat: 'gold', unique: true }),
  I('fish_glass', 'Прозрачная рыба', 'fish', 'epic', 2300, [300, 1800], [20, 45], 2.2, 'fish', ['#bfe6ff', '#ffffff'], 'Сквозь неё видно дно. Иногда видно и что-то ещё.', { loc: ['abyss', 'alien'], pat: 'glass', unique: true }),
  I('fish_armored_pike', 'Панцирная щука', 'fish', 'epic', 2400, [5000, 30000], [100, 220], 3.0, 'fishlong', ['#4c6b5a', '#c9d9b0'], 'Чешуя как кольчуга, зубы как гвозди.', { loc: ['sunken', 'abyss'], pat: 'scale' }),
  I('fish_lunar', 'Лунная рыба', 'fish', 'legendary', 9800, [8000, 60000], [120, 260], 3.4, 'fishflat', ['#8fa0ff', '#f0f4ff'], 'Светится в полнолуние, молчит в остальное время.', { loc: ['abyss', 'alien'], pat: 'glow', unique: true, ability: 'Ночью повышает шанс редкой поклёвки.' }),
  I('fish_twohead', 'Двухголовый окунь', 'fish', 'legendary', 8900, [3000, 15000], [40, 80], 3.1, 'fish', ['#5a7a4a', '#ffd06a'], 'Спорит сам с собой за одну наживку.', { loc: ['lake', 'sunken'], unique: true }),
  I('fish_ghost', 'Призрачная рыба', 'fish', 'mythic', 42000, [900, 6000], [30, 70], 3.2, 'ghost', ['#bfeaff', '#ffffff'], 'Сквозь неё видно берег. Поймать можно, удержать сложно.', { loc: ['ice', 'sunken', 'alien'], pat: 'glow', unique: true, ability: 'Может пройти сквозь подсачек: нужен усиленный подсачек.' }),
  I('fish_leviathan_fry', 'Детёныш левиафана', 'fish', 'mythic', 58000, [40000, 200000], [200, 420], 3.8, 'serpent', ['#1f3b4d', '#7affd0'], 'Детёныш. Родитель где-то рядом.', { loc: ['abyss'], chain: 'leviathan', unique: true }),
  I('fish_void_koi', 'Косяк из ниоткуда', 'fish', 'secret', 210000, [500, 4000], [25, 60], 3.0, 'fish', ['#0b0b12', '#00ffd5'], 'Рыба, которой не существует ни в одном каталоге.', { loc: ['alien'], pat: 'rune', unique: true, ability: 'При вылове открывает подсказку к секретной локации.' }),
];

// ─────────────────────────────── МУСОР ───────────────────────────────
const JUNK: ItemDef[] = [
  I('junk_bottle_plastic', 'Пластиковая бутылка', 'junk', 'common', 3, [20, 60], [20, 32], 0.2, 'bottle', ['#bfe6ff', '#7fbfe0'], 'Полтора литра чьей-то беспечности.', { loc: ['lake', 'harbor', 'ocean'], salvage: [['mat_plastic', 2]] }),
  I('junk_bottle_glass', 'Стеклянная бутылка', 'junk', 'common', 5, [200, 600], [22, 34], 0.3, 'bottle', ['#7aa87a', '#c9e6c9'], 'Зелёное стекло, запечатанное илом.', { loc: ['lake', 'harbor'], pat: 'glass', salvage: [['mat_glass', 2]] }),
  I('junk_can', 'Ржавая банка', 'junk', 'common', 4, [40, 120], [10, 18], 0.25, 'can', ['#8a6a4a', '#c9a06a'], 'Когда-то была тушёнкой.', { loc: ['lake', 'harbor', 'sunken'], pat: 'rust', salvage: [['mat_metal', 1]] }),
  I('junk_boot', 'Резиновый сапог', 'junk', 'common', 6, [400, 1200], [28, 42], 0.5, 'boot', ['#2f3f33', '#5f7f5f'], 'Один. Второй, вероятно, тоже здесь.', { loc: ['lake', 'harbor'], salvage: [['mat_rubber', 2]] }),
  I('junk_umbrella', 'Сломанный зонт', 'junk', 'common', 7, [300, 900], [50, 90], 0.6, 'umbrella', ['#3a3a4a', '#8a8ac9'], 'Вывернут ветром ещё в прошлом веке.', { loc: ['harbor', 'lake'], salvage: [['mat_metal', 2]] }),
  I('junk_pot', 'Кастрюля', 'junk', 'common', 9, [500, 1800], [20, 34], 0.7, 'pot', ['#9aa0a6', '#d9dde0'], 'Без ручки, но с историей.', { loc: ['harbor', 'lake'], pat: 'rust', salvage: [['mat_metal', 3]] }),
  I('junk_plate', 'Автомобильный номер', 'junk', 'uncommon', 45, [80, 200], [44, 48], 0.3, 'plate', ['#d9d9d9', '#2f5fbf'], 'Цифры стёрты, регион — нет.', { loc: ['harbor', 'sunken'], chain: 'harbor_mystery', salvage: [['mat_metal', 2]] }),
  I('junk_key_rusty', 'Ржавый ключ', 'junk', 'uncommon', 55, [30, 90], [6, 12], 0.15, 'key', ['#8a6a3a', '#d9b06a'], 'От чего-то, что всё ещё заперто.', { loc: ['harbor', 'sunken', 'lake'], chain: 'sunken_door' }),
  I('junk_phone_old', 'Кнопочный телефон', 'junk', 'uncommon', 60, [90, 160], [10, 13], 0.3, 'phone', ['#2f3a45', '#7aa87a'], 'Зарядки нет, но змейка внутри — да.', { loc: ['harbor', 'sunken'], salvage: [['mat_electronics', 1], ['mat_plastic', 2]] }),
  I('junk_shovel', 'Лопата', 'junk', 'uncommon', 50, [1200, 3000], [80, 120], 0.9, 'shovel', ['#6a5a3a', '#a0a0a0'], 'Кто-то очень старался что-то закопать.', { loc: ['harbor', 'lake'], pat: 'rust', salvage: [['mat_metal', 4]] }),
  I('junk_canister', 'Канистра', 'junk', 'uncommon', 65, [800, 2200], [30, 45], 0.8, 'canister', ['#8a3a2a', '#d97a4a'], 'Пахнет бензином и приключениями.', { loc: ['harbor', 'sunken'], salvage: [['mat_plastic', 4]] }),
  I('junk_tire', 'Покрышка', 'junk', 'uncommon', 70, [6000, 15000], [60, 80], 1.6, 'tire', ['#1f1f1f', '#3f3f3f'], 'Идеальное укрытие для сома.', { loc: ['lake', 'harbor', 'sunken'], salvage: [['mat_rubber', 6]] }),
  I('junk_headphones', 'Наушники', 'junk', 'uncommon', 80, [150, 400], [16, 24], 0.35, 'headphones', ['#2a2a32', '#8a8aff'], 'В плейлисте всё ещё играет что-то из 2011.', { loc: ['harbor', 'sunken'], salvage: [['mat_electronics', 2]] }),
  I('junk_watch', 'Наручные часы', 'junk', 'rare', 320, [80, 200], [4, 6], 0.25, 'watch', ['#c9b06a', '#f0e6c9'], 'Стрелки стоят на 3:47. Уже давно.', { loc: ['harbor', 'sunken'], chain: 'harbor_mystery', salvage: [['mat_metal', 1]] }),
  I('junk_gamepad', 'Геймпад', 'junk', 'rare', 350, [200, 400], [15, 18], 0.4, 'gamepad', ['#3a3a45', '#ff5f6d'], 'Кнопка «вниз» стёрта до дыр.', { loc: ['sunken', 'harbor'], salvage: [['mat_electronics', 3]] }),
  I('junk_console', 'Игровая приставка', 'junk', 'rare', 460, [1500, 4000], [30, 40], 0.9, 'console', ['#4a4a55', '#57a8ff'], 'Картридж внутри — и он ещё читается.', { loc: ['sunken'], chain: 'sunken_lab', salvage: [['mat_electronics', 5]] }),
  I('junk_tv', 'Телевизор', 'junk', 'rare', 520, [12000, 30000], [60, 90], 2.0, 'tv', ['#2f2f33', '#57ff9a'], 'Кинескоп. Экран всё ещё мутно светится.', { loc: ['harbor', 'sunken'], chain: 'harbor_mystery', salvage: [['mat_electronics', 6], ['mat_glass', 4]] }),
  I('junk_pc', 'Компьютер', 'junk', 'rare', 600, [4000, 12000], [35, 55], 1.4, 'pc', ['#3a3f45', '#57a8ff'], 'Жёсткий диск может хранить чьи-то секреты.', { loc: ['sunken', 'harbor'], chain: 'sunken_lab', salvage: [['mat_electronics', 8]] }),
  I('junk_bike', 'Велосипед', 'junk', 'rare', 700, [8000, 20000], [150, 190], 2.2, 'bike', ['#5a4a3a', '#c94a4a'], 'Ржавый, но спицы всё ещё звенят.', { loc: ['harbor', 'sunken'], salvage: [['mat_metal', 10]] }),
  I('junk_suitcase', 'Чемодан', 'junk', 'epic', 1800, [3000, 9000], [55, 80], 1.5, 'suitcase', ['#5a3a2a', '#c9a06a'], 'Заперт. Внутри что-то перекатывается.', { loc: ['harbor', 'sunken'], chain: 'harbor_mystery', salvage: [['mat_leather', 6], ['mat_metal', 3]] }),
  I('junk_vending', 'Торговый автомат', 'junk', 'epic', 3200, [120000, 300000], [170, 200], 3.6, 'vending', ['#8a2a3a', '#ffd06a'], 'Полный монет и, возможно, чего-то живого.', { loc: ['sunken'], salvage: [['mat_metal', 40], ['mat_electronics', 12]] }),
  I('junk_washer', 'Стиральная машина', 'junk', 'epic', 2600, [40000, 90000], [80, 100], 3.2, 'washer', ['#c9c9c9', '#57a8ff'], 'Внутри — чей-то носок и что-то похуже.', { loc: ['sunken', 'harbor'], salvage: [['mat_metal', 25], ['mat_electronics', 6]] }),
  I('junk_microwave', 'Микроволновка', 'junk', 'uncommon', 140, [8000, 18000], [45, 55], 1.2, 'microwave', ['#3a3a3f', '#ffb038'], 'Внутри всё ещё пахнет рыбой. Странно.', { loc: ['harbor', 'sunken'], salvage: [['mat_metal', 8], ['mat_electronics', 2]] }),
  I('junk_vacuum', 'Пылесос', 'junk', 'uncommon', 120, [4000, 9000], [40, 55], 1.0, 'vacuum', ['#c94a4a', '#3a3a3f'], 'Всасывает всё, кроме воды. Пока.', { loc: ['harbor'], salvage: [['mat_plastic', 8], ['mat_metal', 4]] }),
  I('junk_guitar', 'Гитара', 'junk', 'rare', 480, [2000, 5000], [95, 110], 1.3, 'guitar', ['#8a5a2a', '#e0c07a'], 'Струн нет. Аккорд всё равно слышен.', { loc: ['harbor', 'sunken'], salvage: [['mat_wood', 10]] }),
];

// ─────────────────────────────── СОКРОВИЩА И АРТЕФАКТЫ ───────────────────────────────
const TREASURE: ItemDef[] = [
  I('tre_coin_old', 'Старая монета', 'treasure', 'uncommon', 90, [5, 20], [2, 3], 0.1, 'coin', ['#a88a3a', '#e0c477'], 'Потёртая, но всё ещё звенит.', { loc: ['harbor', 'sunken', 'lake'], salvage: [['mat_gold', 1]] }),
  I('tre_coin_gold', 'Золотая монета', 'treasure', 'rare', 420, [8, 25], [2, 3], 0.1, 'coin', ['#ffb038', '#fff2b0'], 'Чистое золото, чистая жадность.', { loc: ['sunken', 'harbor', 'ocean'], pat: 'gold', salvage: [['mat_gold', 3]] }),
  I('tre_chain', 'Золотая цепь', 'treasure', 'rare', 560, [40, 200], [40, 70], 0.3, 'chain', ['#ffb038', '#fff2b0'], 'Кто-то потерял её очень неохотно.', { loc: ['harbor', 'sunken'], pat: 'gold', salvage: [['mat_gold', 4]] }),
  I('tre_pearl', 'Жемчужина', 'treasure', 'rare', 620, [5, 30], [0.8, 2], 0.05, 'pearl', ['#e6f2ff', '#ffffff'], 'Растёт десятилетиями ради одной секунды.', { loc: ['ocean', 'sunken'], pat: 'glow', salvage: [['mat_pearl', 1]] }),
  I('tre_cup', 'Кубок', 'treasure', 'rare', 700, [800, 2500], [25, 40], 0.6, 'cup', ['#c9b06a', '#fff2b0'], 'За победу в чём-то важном.', { loc: ['sunken', 'harbor'], pat: 'gold', salvage: [['mat_gold', 5]] }),
  I('tre_gem_emerald', 'Изумруд', 'treasure', 'epic', 2400, [3, 15], [1, 2.5], 0.05, 'gem', ['#2fbf6a', '#c9ffe0'], 'Зелёный, как вода в омуте.', { loc: ['abyss', 'sunken'], pat: 'glow', salvage: [['mat_gem', 2]] }),
  I('tre_gem_ruby', 'Рубин', 'treasure', 'epic', 2600, [3, 15], [1, 2.5], 0.05, 'gem', ['#e02f4a', '#ffc9d0'], 'Красный, как первый рассвет на воде.', { loc: ['abyss', 'sunken'], pat: 'glow', salvage: [['mat_gem', 2]] }),
  I('tre_gem_sapphire', 'Сапфир', 'treasure', 'epic', 2800, [3, 15], [1, 2.5], 0.05, 'gem', ['#2f6fe0', '#c9e0ff'], 'Синий, как бездна под лодкой.', { loc: ['abyss', 'ocean'], pat: 'glow', salvage: [['mat_gem', 2]] }),
  I('tre_ingot_silver', 'Серебряный слиток', 'treasure', 'epic', 2200, [4000, 12000], [15, 25], 1.6, 'ingot', ['#c9d0d9', '#ffffff'], 'Тяжелее, чем кажется. Всегда.', { loc: ['sunken', 'abyss'], salvage: [['mat_silver', 8]] }),
  I('tre_ingot_gold', 'Золотой слиток', 'treasure', 'legendary', 12000, [8000, 25000], [15, 25], 2.0, 'ingot', ['#ffb038', '#fff2b0'], 'Приятная тяжесть в руке и в кошельке.', { loc: ['sunken', 'abyss'], pat: 'gold', salvage: [['mat_gold', 20]] }),
  I('tre_casket', 'Шкатулка', 'treasure', 'epic', 1900, [500, 2500], [14, 28], 0.4, 'casket', ['#6a4a2a', '#c9a06a'], 'Замочек хрупкий, тайна — нет.', { loc: ['harbor', 'sunken', 'lake'], chain: 'harbor_mystery' }),
  I('tre_map', 'Карта сокровищ', 'treasure', 'epic', 2100, [30, 120], [30, 60], 0.1, 'map', ['#d9c9a0', '#8a5a2a'], 'Половина карты. Вторая — где-то на дне.', { loc: ['sunken', 'harbor'], chain: 'sunken_door', unique: false }),
  I('tre_key_secret', 'Секретный ключ', 'treasure', 'legendary', 9500, [20, 80], [8, 16], 0.15, 'key', ['#ffb038', '#fff2b0'], 'Открывает то, что лучше бы не открывать.', { loc: ['sunken', 'alien', 'abyss'], chain: 'sunken_door', pat: 'rune' }),
  I('tre_mask', 'Древняя маска', 'treasure', 'legendary', 11000, [900, 3000], [22, 34], 0.6, 'mask', ['#3a2a2a', '#ffb038'], 'Смотрит даже тогда, когда лежит лицом вниз.', { loc: ['sunken', 'alien'], pat: 'rune', unique: true, ability: 'Ночью подсказывает направление к редким находкам.' }),
  I('tre_crown', 'Корона', 'treasure', 'legendary', 16000, [1200, 4000], [18, 26], 0.8, 'crown', ['#ffb038', '#e02f6a'], 'Правила уже никто не помнит.', { loc: ['sunken', 'abyss'], pat: 'gold', unique: true }),
  I('tre_relic', 'Реликвия глубин', 'treasure', 'legendary', 14000, [2000, 9000], [25, 45], 1.2, 'relic', ['#2f4f5f', '#00ffd5'], 'Гудит, если поднести к воде.', { loc: ['abyss', 'sunken'], pat: 'rune', unique: true, ability: 'Гудит рядом с аномалиями.' }),
  I('tre_chest', 'Затонувший сундук', 'treasure', 'legendary', 18000, [15000, 60000], [60, 95], 2.6, 'chest', ['#5a3a1a', '#ffb038'], 'Заперт, тяжёл и полон надежд.', { loc: ['sunken', 'abyss'], chain: 'leviathan' }),
  I('tre_part_mech', 'Часть древнего механизма', 'treasure', 'rare', 800, [1500, 8000], [30, 70], 1.3, 'part', ['#6a6a5a', '#c9b06a'], 'Одна деталь из чего-то огромного.', { loc: ['sunken', 'abyss', 'alien'], chain: 'ancient_engine', researchable: true, salvage: [['mat_ancient', 3]] }),
  I('tre_ark_shard', 'Обломок ковчега', 'treasure', 'mythic', 52000, [40000, 150000], [80, 200], 3.4, 'ark', ['#3a5a4a', '#00ffd5'], 'Дерево не гниёт. Совсем.', { loc: ['abyss', 'alien'], pat: 'rune', unique: true }),
];

// ─────────────────────────────── ТЕХНИКА ───────────────────────────────
const TECH: ItemDef[] = [
  I('tech_battery', 'Разряженная батарея', 'tech', 'uncommon', 95, [400, 1500], [12, 22], 0.4, 'battery', ['#2f3f4f', '#57ff9a'], 'Индикатор мигает. Это невозможно, но он мигает.', { loc: ['harbor', 'sunken', 'abyss'], salvage: [['mat_electronics', 3]] }),
  I('tech_camera', 'Камера наблюдения', 'tech', 'rare', 420, [600, 2000], [14, 26], 0.5, 'camera', ['#3a3f45', '#57a8ff'], 'Плёнка внутри ещё не проявлена.', { loc: ['harbor', 'sunken'], chain: 'sunken_lab', salvage: [['mat_electronics', 4], ['mat_glass', 2]] }),
  I('tech_propeller', 'Винт субмарины', 'tech', 'rare', 560, [8000, 30000], [50, 90], 2.0, 'propeller', ['#8a7a4a', '#c9b06a'], 'Погнут, но всё ещё режет воду.', { loc: ['sunken', 'abyss'], salvage: [['mat_metal', 12]] }),
  I('tech_engine', 'Двигатель', 'tech', 'epic', 2800, [40000, 120000], [70, 120], 3.2, 'engine', ['#4a4a4a', '#ff8a3a'], 'Проворачивается, если приложить силу.', { loc: ['sunken', 'abyss'], chain: 'ancient_engine', salvage: [['mat_metal', 30]] }),
  I('tech_sonar', 'Гидролокатор', 'tech', 'epic', 3100, [6000, 20000], [40, 70], 1.6, 'sonar', ['#2f4f5f', '#57ff9a'], 'Пищит на что-то большое и очень далёкое.', { loc: ['abyss', 'sunken'], researchable: true, salvage: [['mat_electronics', 10]] }),
  I('tech_drone', 'Подводный дрон', 'tech', 'epic', 3400, [3000, 9000], [50, 80], 1.4, 'drone', ['#3a4a5a', '#ffd06a'], 'Аккумулятор мёртв, память жива.', { loc: ['sunken', 'abyss'], chain: 'sunken_lab', researchable: true }),
  I('tech_robot', 'Робот-манипулятор', 'tech', 'legendary', 10500, [30000, 90000], [120, 200], 3.5, 'robot', ['#5a5a6a', '#57a8ff'], 'При включении пытается что-то схватить.', { loc: ['sunken', 'alien'], unique: true, researchable: true }),
  I('tech_blackbox', 'Чёрный ящик', 'tech', 'legendary', 13000, [5000, 15000], [30, 50], 1.5, 'blackbox', ['#e0572a', '#ffd06a'], 'Бортовой самописец. Кто-то очень не хотел, чтобы его нашли.', { loc: ['abyss', 'sunken'], chain: 'ancient_engine', unique: true, researchable: true }),
  I('tech_satellite', 'Спутниковый модуль', 'tech', 'mythic', 48000, [20000, 70000], [60, 110], 3.0, 'satellite', ['#9aa0a6', '#57ff9a'], 'Он всё ещё передаёт. Куда?', { loc: ['abyss', 'alien'], unique: true, researchable: true }),
  I('tech_container', 'Лабораторный контейнер', 'tech', 'epic', 3600, [9000, 30000], [55, 90], 1.8, 'container', ['#4a6a5a', '#a8ff7a'], 'Герметичен. Внутри что-то шевелится.', { loc: ['sunken', 'alien'], chain: 'sunken_lab', researchable: true }),
  I('tech_device_unknown', 'Экспериментальный прибор', 'tech', 'legendary', 12500, [2500, 8000], [25, 45], 1.2, 'device', ['#3a3f5f', '#b46bff'], 'Ни кнопок, ни разъёмов, ни инструкции.', { loc: ['alien', 'sunken'], researchable: true, unique: true, ability: 'После исследования открывает детектор аномалий.' }),
];

// ─────────────────────────────── ФАНТАСТИКА ───────────────────────────────
const FANTASY: ItemDef[] = [
  I('fan_shard', 'Осколок неизвестного сплава', 'fantasy', 'rare', 700, [300, 2500], [10, 30], 0.8, 'part', ['#4a3a5a', '#b46bff'], 'Не царапается, не плавится, не тонет… почти.', { loc: ['alien', 'abyss'], salvage: [['mat_ancient', 2]] }),
  I('fan_echo', 'Эхо-камень', 'fantasy', 'epic', 2500, [400, 1800], [8, 18], 0.5, 'echo', ['#2f4f5f', '#00ffd5'], 'Повторяет звуки, которых не было.', { loc: ['alien', 'abyss'], pat: 'rune', researchable: true }),
  I('fan_crystal', 'Инопланетный кристалл', 'fantasy', 'epic', 3300, [600, 4000], [12, 35], 0.9, 'crystal', ['#3a2f6a', '#00ffd5'], 'Внутри медленно движется свет.', { loc: ['alien', 'abyss'], pat: 'glow', researchable: true, salvage: [['mat_crystal', 3]] }),
  I('fan_orb', 'Загадочная сфера', 'fantasy', 'legendary', 11500, [2000, 9000], [20, 40], 1.4, 'orb', ['#1f2f4f', '#57d0ff'], 'Идеальный шар. Ни шва, ни царапины.', { loc: ['alien', 'abyss'], pat: 'glow', unique: true, researchable: true }),
  I('fan_disk', 'Обсидиановый диск', 'fantasy', 'legendary', 10200, [1500, 6000], [25, 50], 1.1, 'disk', ['#141420', '#ffb038'], 'Символы двигаются, если долго смотреть.', { loc: ['alien', 'sunken'], pat: 'rune', researchable: true }),
  I('fan_liquid', 'Жидкий металл', 'fantasy', 'legendary', 13800, [3000, 12000], [12, 25], 1.7, 'liquid', ['#5a6a7a', '#c9f0ff'], 'В бутылке он спокоен. Всегда ли?', { loc: ['alien'], pat: 'glass', unique: true, researchable: true }),
  I('fan_rod', 'Плазменный стержень', 'fantasy', 'legendary', 14200, [1200, 5000], [40, 90], 1.0, 'rod', ['#2f1f3f', '#ff5f6d'], 'Тёплый. Даже под водой.', { loc: ['alien', 'abyss'], pat: 'glow', researchable: true }),
  I('fan_portal_part', 'Частица портала', 'fantasy', 'mythic', 46000, [100, 900], [4, 12], 0.4, 'portalpart', ['#0b0b12', '#00ffd5'], 'Пространство вокруг неё слегка неправильное.', { loc: ['alien'], pat: 'rune', unique: true, researchable: true, chain: 'portal' }),
  I('fan_anomaly_core', 'Ядро аномалии', 'fantasy', 'mythic', 56000, [5000, 25000], [20, 50], 2.4, 'crystal', ['#0b0b12', '#ff5f6d'], 'Сжимает воду вокруг себя в тишину.', { loc: ['alien', 'abyss'], pat: 'rune', unique: true, researchable: true, chain: 'portal' }),
  I('fan_heart', 'Сердце озера', 'fantasy', 'secret', 320000, [20000, 80000], [40, 90], 3.6, 'heart', ['#0b0b12', '#ff5f6d'], 'Бьётся в такт с чьим-то дыханием.', { loc: ['alien'], pat: 'glow', unique: true, serial: 3, circulate: true, chain: 'portal' }),
];

// ─────────────────────────────── ОГРОМНЫЕ И МИФИЧЕСКИЕ ───────────────────────────────
const GIANT: ItemDef[] = [
  I('giant_catfish', 'Гигантский сом', 'giant', 'legendary', 15000, [40000, 180000], [180, 320], 4.2, 'fishlong', ['#2f2a24', '#a89880'], 'Хозяин ямы. Тянет вниз и не торопится.', { loc: ['lake', 'abyss'], pat: 'spots', tags: ['boss'], chain: 'giant_catfish' }),
  I('giant_safe', 'Затонувший сейф', 'giant', 'legendary', 17000, [200000, 900000], [120, 200], 4.5, 'safe', ['#3a3f45', '#ffb038'], 'Тяжёлый, ржавый и, возможно, не пустой.', { loc: ['harbor', 'sunken'], tags: ['boss'], chain: 'safe_code', researchable: true }),
  I('giant_anchor', 'Корабельный якорь', 'giant', 'epic', 3000, [150000, 600000], [180, 280], 4.0, 'anchor', ['#4a4a4a', '#8a6a3a'], 'Держал корабль, который больше не приплывёт.', { loc: ['harbor', 'sunken'], pat: 'rust', salvage: [['mat_metal', 60]] }),
  I('giant_wreck', 'Часть корабля', 'giant', 'epic', 3800, [300000, 1500000], [250, 500], 4.6, 'wreckpart', ['#4a3a2a', '#8a7a5a'], 'Обломок с чужого борта.', { loc: ['sunken', 'abyss'], salvage: [['mat_wood', 50]] }),
  I('giant_turtle', 'Гигантская черепаха', 'giant', 'legendary', 14000, [120000, 400000], [150, 260], 3.8, 'turtle', ['#3a5a3a', '#a8c96a'], 'Спокойна как скала. Просто не мешайте.', { loc: ['ocean', 'abyss'], unique: true, tags: ['boss'] }),
  I('giant_kraken', 'Кракен', 'giant', 'mythic', 62000, [300000, 1200000], [300, 900], 5.0, 'kraken', ['#2f1f4f', '#ff5f9a'], 'Утащит лодку, если зазеваться.', { loc: ['abyss'], unique: true, tags: ['boss'], chain: 'kraken' }),
  I('giant_serpent', 'Морской змей', 'giant', 'mythic', 68000, [200000, 900000], [400, 1200], 5.2, 'serpent', ['#1f4f3f', '#a8ff7a'], 'Показывается по частям. Никогда целиком.', { loc: ['abyss', 'ocean'], unique: true, tags: ['boss'], chain: 'leviathan' }),
  I('giant_statue', 'Затонувшая статуя', 'giant', 'legendary', 12000, [250000, 1000000], [200, 400], 4.4, 'statue', ['#5a6a6a', '#c9d9c9'], 'Смотрит вверх, на свет, которого здесь нет.', { loc: ['sunken', 'abyss'], unique: true }),
  I('giant_ark', 'Ковчег неизвестных', 'giant', 'secret', 400000, [1000000, 5000000], [600, 1800], 5.5, 'ark', ['#2f4f4f', '#00ffd5'], 'Он не затонул. Он пришвартован.', { loc: ['alien', 'abyss'], unique: true, serial: 1, circulate: true, chain: 'leviathan' }),
  I('giant_void_key', 'Ключ от всего', 'giant', 'secret', 500000, [500, 2000], [15, 30], 3.0, 'voidkey', ['#0b0b12', '#00ffd5'], 'Описание отсутствует. Каталог не знает, что это.', { loc: ['alien'], unique: true, serial: 7, circulate: true, pat: 'rune', chain: 'portal' }),
];

// Серийные экземпляры: ограниченный тираж на весь сервер.
const SERIAL_ITEMS: ItemDef[] = [
  I('ser_mask_first', 'Маска Первого Смотрителя', 'treasure', 'secret', 180000, [1500, 3500], [24, 32], 2.0, 'mask', ['#1a1a24', '#ffb038'], 'Экземпляр из ограниченного тиража. Возвращается в пучину, если владелец исчезает.', { loc: ['sunken', 'abyss'], serial: 100, circulate: true, unique: true, pat: 'rune', chain: 'sunken_door' }),
  I('ser_coin_mint', 'Монета Первой Чеканки', 'treasure', 'secret', 150000, [20, 40], [3, 4], 0.2, 'coin', ['#ffb038', '#00ffd5'], 'Пронумерована на сервере. Второй такой же не будет.', { loc: ['sunken', 'harbor'], serial: 50, circulate: true, unique: true, pat: 'rune' }),
  I('ser_engine_core', 'Ядро Затонувшей Лаборатории', 'tech', 'secret', 240000, [9000, 20000], [30, 50], 2.6, 'engine', ['#0b0b12', '#57ff9a'], 'Ядро питало лабораторию. Ещё немного питания осталось.', { loc: ['sunken', 'alien'], serial: 25, circulate: true, unique: true, researchable: true }),
  I('ser_gem_abyss', 'Слеза Бездны', 'treasure', 'secret', 200000, [10, 40], [2, 4], 0.3, 'gem', ['#0b0b12', '#57d0ff'], 'Кристалл из места, куда не опускается свет.', { loc: ['abyss'], serial: 75, circulate: true, unique: true, pat: 'glow' }),
];

export const ITEMS: ItemDef[] = [...FISH, ...JUNK, ...TREASURE, ...TECH, ...FANTASY, ...GIANT, ...SERIAL_ITEMS];
export const ITEM_BY_ID: Record<string, ItemDef> = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

// ─────────────────────────────── ЛОКАЦИИ ───────────────────────────────
export interface LocationDef {
  id: string;
  name: string;
  level: number;              // требуемый уровень
  cost: number;               // стоимость открытия
  desc: string;
  depth: number;
  rarity: Record<Rarity, number>;
  cat: Record<Category, number>;
  npcMult: number;            // множитель цен торговца
  tells: string[];            // визуальные подсказки локации
  ambient: string;            // цвет сцены
}

export const LOCATIONS: LocationDef[] = [
  {
    id: 'lake', name: 'Лесное озеро', level: 1, cost: 0, depth: 1, ambient: '#123a2f',
    desc: 'Стартовая зона: первые поклёвки, мусор, мелкая рыба и первые странные следы на воде.',
    rarity: { common: 62, uncommon: 26, rare: 9, epic: 2.4, legendary: 0.5, mythic: 0.09, secret: 0.01 },
    cat: { fish: 52, junk: 28, treasure: 10, tech: 6, fantasy: 2, giant: 2 },
    npcMult: 1,
    tells: ['Круги на воде', 'Пузыри у камыша', 'Тень под кувшинками', 'Рябь без ветра'],
  },
  {
    id: 'harbor', name: 'Старая гавань', level: 3, cost: 0, depth: 2, ambient: '#1b2b3a',
    desc: 'Ржавые краны, забытые вещи и затонувшие чемоданы. Много бытового мусора и техники.',
    rarity: { common: 50, uncommon: 30, rare: 14, epic: 4.5, legendary: 1.2, mythic: 0.25, secret: 0.05 },
    cat: { fish: 32, junk: 34, treasure: 14, tech: 14, fantasy: 2, giant: 4 },
    npcMult: 1.1,
    tells: ['Металлический стук по свае', 'Маслянистое пятно', 'Блеск под пирсом', 'Странный гул у крана'],
  },
  {
    id: 'ocean', name: 'Тропический океан', level: 6, cost: 2500, depth: 3, ambient: '#0f3d52',
    desc: 'Экзотические рыбы, коралловые сокровища и хищники, которые кусают леску.',
    rarity: { common: 42, uncommon: 32, rare: 18, epic: 6, legendary: 1.6, mythic: 0.35, secret: 0.05 },
    cat: { fish: 46, junk: 14, treasure: 20, tech: 10, fantasy: 6, giant: 4 },
    npcMult: 1.25,
    tells: ['Стая мальков врассыпную', 'Жемчужный отсвет', 'Движение в кораллах', 'Низкий гул течения'],
  },
  {
    id: 'ice', name: 'Ледяное озеро', level: 9, cost: 9000, depth: 3, ambient: '#26445a',
    desc: 'Замороженные артефакты и рыбы, которые не должны жить в такой воде.',
    rarity: { common: 40, uncommon: 30, rare: 20, epic: 7, legendary: 2.2, mythic: 0.6, secret: 0.1 },
    cat: { fish: 44, junk: 16, treasure: 20, tech: 10, fantasy: 6, giant: 4 },
    npcMult: 1.35,
    tells: ['Трещина во льду', 'Свет под водой', 'Иней на леске', 'Тень под самым льдом'],
  },
  {
    id: 'abyss', name: 'Морская бездна', level: 14, cost: 40000, depth: 5, ambient: '#080d18',
    desc: 'Гигантские существа и многоэтапные вываживания. Здесь ломаются дешёвые снасти.',
    rarity: { common: 24, uncommon: 30, rare: 26, epic: 13, legendary: 5, mythic: 1.6, secret: 0.35 },
    cat: { fish: 34, junk: 8, treasure: 16, tech: 16, fantasy: 14, giant: 12 },
    npcMult: 1.6,
    tells: ['Крупная тень под лодкой', 'Свечение в глубине', 'Удар по корпусу', 'Сонарный писк'],
  },
  {
    id: 'sunken', name: 'Затонувший город', level: 18, cost: 120000, depth: 4, ambient: '#123a3a',
    desc: 'Древние механизмы, секретные хранилища и сюжетные цепочки находок.',
    rarity: { common: 22, uncommon: 28, rare: 28, epic: 14, legendary: 5.6, mythic: 1.9, secret: 0.5 },
    cat: { fish: 24, junk: 18, treasure: 26, tech: 20, fantasy: 8, giant: 4 },
    npcMult: 1.7,
    tells: ['Свет в окне дома', 'Дверь, которая закрыта', 'Механический щелчок', 'Символы на стене'],
  },
  {
    id: 'alien', name: 'Инопланетное озеро', level: 24, cost: 400000, depth: 6, ambient: '#1a0f2e',
    desc: 'Фантастические предметы, неизвестные формы жизни и вода, которая ведёт себя странно.',
    rarity: { common: 16, uncommon: 26, rare: 28, epic: 18, legendary: 8, mythic: 3.4, secret: 0.6 },
    cat: { fish: 28, junk: 6, treasure: 12, tech: 18, fantasy: 28, giant: 8 },
    npcMult: 1.9,
    tells: ['Вода светится', 'Звук, которого нет', 'Пространство дрожит', 'Отражение без источника'],
  },
];
export const LOC_BY_ID: Record<string, LocationDef> = Object.fromEntries(LOCATIONS.map((l) => [l.id, l]));

// ─────────────────────────────── СНАРЯЖЕНИЕ ───────────────────────────────
export type GearSlot = 'rod' | 'reel' | 'line' | 'hook' | 'bait' | 'net' | 'boat' | 'device';

export interface GearDef {
  id: string;
  slot: GearSlot;
  name: string;
  price: number;
  level: number;
  desc: string;
  maxLoad?: number;        // кг — предел нагрузки (удочки, лески)
  control?: number;        // контроль натяжения
  speed?: number;          // скорость вываживания
  luck?: number;           // влияние на редкость
  specialty?: Category;    // специализация
  specialtyBonus?: number;
  bias?: Partial<Record<Category, number>>; // для наживок
  rarityBias?: number;
  consumable?: boolean;
  access?: { depth?: number; locations?: string[] };
  cosmetic?: boolean;
  starsOnly?: boolean;
  lures?: string[];        // цепочки/виды, на которые влияет наживка
}

export const GEAR: GearDef[] = [
  // Удочки
  { id: 'rod_bamboo', slot: 'rod', name: 'Бамбуковая удочка', price: 0, level: 1, maxLoad: 4, control: 1, speed: 1, desc: 'Досталась от деда. Хрустит, но ловит.' },
  { id: 'rod_fiberglass', slot: 'rod', name: 'Стеклопластиковая удочка', price: 900, level: 3, maxLoad: 12, control: 1.1, speed: 1.05, desc: 'Надёжнее бамбука, но всё ещё не для гигантов.' },
  { id: 'rod_carbon', slot: 'rod', name: 'Карбоновая удочка', price: 6500, level: 7, maxLoad: 30, control: 1.25, speed: 1.15, luck: 0.05, desc: 'Лёгкая и чувствительная. Слышно, как рыба думает.' },
  { id: 'rod_treasure', slot: 'rod', name: 'Удочка «Кладоискатель»', price: 22000, level: 11, maxLoad: 60, control: 1.2, speed: 1.1, specialty: 'treasure', specialtyBonus: 0.35, desc: 'Специализация на сокровищах и артефактах: +35% к шансу категории.' },
  { id: 'rod_monster', slot: 'rod', name: 'Удочка «Голиаф»', price: 60000, level: 15, maxLoad: 150, control: 1.15, speed: 1.2, specialty: 'giant', specialtyBonus: 0.4, desc: 'Создана для гигантов: +40% к шансу огромных находок и повышенный предел нагрузки.' },
  { id: 'rod_abyss', slot: 'rod', name: 'Бездна-удочка', price: 150000, level: 19, maxLoad: 320, control: 1.3, speed: 1.25, luck: 0.12, access: { depth: 5 }, desc: 'Открывает глубинные забросы, не боится давления.' },
  { id: 'rod_alien', slot: 'rod', name: 'Резонансная удочка', price: 400000, level: 24, maxLoad: 600, control: 1.45, speed: 1.35, luck: 0.2, access: { depth: 6 }, desc: 'Резонирует с аномалиями: +20% к редкости и доступ к инопланетным глубинам.' },
  // Катушки
  { id: 'reel_simple', slot: 'reel', name: 'Простая катушка', price: 0, level: 1, speed: 1, control: 1, desc: 'Крутится. Иногда в нужную сторону.' },
  { id: 'reel_metal', slot: 'reel', name: 'Металлическая катушка', price: 1200, level: 4, speed: 1.15, control: 1.1, desc: 'Плавнее и быстрее.' },
  { id: 'reel_baitcaster', slot: 'reel', name: 'Мультипликатор', price: 8000, level: 8, speed: 1.3, control: 1.2, desc: 'Точный контроль натяжения на рывках.' },
  { id: 'reel_servo', slot: 'reel', name: 'Сервокатушка', price: 28000, level: 12, speed: 1.45, control: 1.3, desc: 'Сама гасит рывки. Почти жульничество.' },
  { id: 'reel_abyss', slot: 'reel', name: 'Катушка «Левиафан»', price: 95000, level: 17, speed: 1.6, control: 1.45, desc: 'Тянет даже то, что тянет обратно.' },
  // Лески
  { id: 'line_2', slot: 'line', name: 'Леска 2 кг', price: 0, level: 1, maxLoad: 2, control: 1, desc: 'Тонкая, как надежда.' },
  { id: 'line_6', slot: 'line', name: 'Леска 6 кг', price: 400, level: 2, maxLoad: 6, control: 1, desc: 'Держит обычную рыбу.' },
  { id: 'line_14', slot: 'line', name: 'Леска 14 кг', price: 2000, level: 5, maxLoad: 14, control: 1.05, desc: 'Для серьёзных поклёвок.' },
  { id: 'line_30', slot: 'line', name: 'Плетёнка 30 кг', price: 9000, level: 9, maxLoad: 30, control: 1.1, desc: 'Почти не тянется. Хорошо и плохо одновременно.' },
  { id: 'line_70', slot: 'line', name: 'Плетёнка 70 кг', price: 34000, level: 13, maxLoad: 70, control: 1.15, desc: 'Для тех, кто ловит технику.' },
  { id: 'line_160', slot: 'line', name: 'Трос 160 кг', price: 110000, level: 18, maxLoad: 160, control: 1.2, desc: 'Формально это уже не леска.' },
  { id: 'line_400', slot: 'line', name: 'Композитный трос 400 кг', price: 340000, level: 23, maxLoad: 400, control: 1.3, desc: 'Выдержит сейф. Возможно.' },
  // Крючки
  { id: 'hook_small', slot: 'hook', name: 'Крючок №8', price: 0, level: 1, desc: 'Для мелочи.', bias: { fish: 1.15 } },
  { id: 'hook_medium', slot: 'hook', name: 'Крючок №4', price: 500, level: 3, desc: 'Универсальный.', bias: { fish: 1.1, junk: 1.1 } },
  { id: 'hook_large', slot: 'hook', name: 'Крючок №1/0', price: 4000, level: 6, desc: 'Для крупной рыбы и техники.', bias: { fish: 1.15, tech: 1.25 } },
  { id: 'hook_treasure', slot: 'hook', name: 'Зацеп-искатель', price: 16000, level: 10, desc: 'Хорошо цепляет твёрдые предметы.', bias: { treasure: 1.5, junk: 1.2 } },
  { id: 'hook_giant', slot: 'hook', name: 'Усиленный крюк', price: 55000, level: 14, desc: 'Не разгибается даже на гигантах.', bias: { giant: 1.6 } },
  { id: 'hook_void', slot: 'hook', name: 'Крюк пустоты', price: 260000, level: 22, desc: 'Цепляет то, что не должно цепляться.', bias: { fantasy: 2.0, giant: 1.3 }, rarityBias: 1.15 },
  // Наживки (расходники)
  { id: 'bait_worm', slot: 'bait', name: 'Червь', price: 5, level: 1, consumable: true, desc: 'Классика.', bias: { fish: 1.2 } },
  { id: 'bait_bread', slot: 'bait', name: 'Хлеб', price: 3, level: 1, consumable: true, desc: 'Дёшево и сердито.', bias: { fish: 1.1, junk: 1.1 } },
  { id: 'bait_lure', slot: 'bait', name: 'Блесна', price: 40, level: 4, consumable: true, desc: 'Для хищников.', bias: { fish: 1.35 } },
  { id: 'bait_live', slot: 'bait', name: 'Живец', price: 120, level: 7, consumable: true, desc: 'Для сомов и щук.', bias: { fish: 1.4, giant: 1.3 } },
  { id: 'bait_blood', slot: 'bait', name: 'Кровавая приманка', price: 350, level: 11, consumable: true, desc: 'Собирает всё живое и не очень.', bias: { fish: 1.3, giant: 1.5 } },
  { id: 'bait_glow', slot: 'bait', name: 'Светящаяся приманка', price: 900, level: 15, consumable: true, desc: 'Работает в темноте.', bias: { fantasy: 1.6, fish: 1.15 }, rarityBias: 1.1 },
  { id: 'bait_treasure', slot: 'bait', name: 'Магнитная приманка', price: 1500, level: 13, consumable: true, desc: 'Тянет металл и ценности.', bias: { treasure: 1.7, tech: 1.5 } },
  { id: 'bait_alien', slot: 'bait', name: 'Аномальная приманка', price: 4200, level: 21, consumable: true, desc: 'Из чего она сделана — лучше не знать.', bias: { fantasy: 2.2, giant: 1.2 }, rarityBias: 1.2 },
  // Подсаки
  { id: 'net_basic', slot: 'net', name: 'Подсачек', price: 300, level: 2, desc: 'Помогает на финале вываживания.', control: 1.05 },
  { id: 'net_pro', slot: 'net', name: 'Усиленный подсачек', price: 7000, level: 9, desc: 'Держит крупную рыбу.', control: 1.15 },
  { id: 'net_giant', slot: 'net', name: 'Подъёмный кран-подсачек', price: 48000, level: 16, desc: 'Для находок, которые больше лодки.', control: 1.3 },
  // Лодки
  { id: 'boat_none', slot: 'boat', name: 'Берег', price: 0, level: 1, desc: 'Ловим с берега.', access: { depth: 2 } },
  { id: 'boat_row', slot: 'boat', name: 'Вёсельная лодка', price: 2500, level: 5, desc: 'Дальние забросы доступны.', access: { depth: 3 } },
  { id: 'boat_motor', slot: 'boat', name: 'Моторная лодка', price: 18000, level: 10, desc: 'Быстро меняете точку.', access: { depth: 4 } },
  { id: 'boat_sub', slot: 'boat', name: 'Мини-субмарина', price: 90000, level: 16, desc: 'Забросы на глубину.', access: { depth: 5 } },
  { id: 'boat_bathyscaphe', slot: 'boat', name: 'Экспедиционный батискаф', price: 380000, level: 22, desc: 'Достаёт до дна бездны.', access: { depth: 6 } },
  // Приборы
  { id: 'device_none', slot: 'device', name: 'Нет прибора', price: 0, level: 1, desc: 'Смотрим глазами.', access: { depth: 2 } },
  { id: 'device_depth', slot: 'device', name: 'Эхолот', price: 3500, level: 6, desc: 'Показывает глубину и силуэты.', access: { depth: 3 } },
  { id: 'device_scanner', slot: 'device', name: 'Сканер аномалий', price: 42000, level: 17, desc: 'Находит следы событий и аномалий.', access: { depth: 5 } },
  { id: 'device_tracker', slot: 'device', name: 'Биотрекер', price: 26000, level: 13, desc: 'Показывает поведение существа.', access: { depth: 4 }, luck: 0.08 },
  { id: 'device_void', slot: 'device', name: 'Детектор пустоты', price: 300000, level: 23, desc: 'Видит то, чего нет.', access: { depth: 6 }, luck: 0.18 },
];

export const GEAR_BY_ID: Record<string, GearDef> = Object.fromEntries(GEAR.map((g) => [g.id, g]));
export const DEFAULT_LOADOUT = { rod: 'rod_bamboo', reel: 'reel_simple', line: 'line_2', hook: 'hook_small', bait: 'bait_worm', net: 'net_basic', boat: 'boat_none', device: 'device_none' };

// ─────────────────────────────── МАТЕРИАЛЫ ───────────────────────────────
export interface MaterialDef { id: string; name: string; price: number; desc: string }
export const MATERIALS: MaterialDef[] = [
  { id: 'mat_meat', name: 'Свежее мясо', price: 8, desc: 'Наживка и еда для лаборатории.' },
  { id: 'mat_wood', name: 'Дерево', price: 6, desc: 'Из коряг и обломков.' },
  { id: 'mat_metal', name: 'Металл', price: 12, desc: 'Ржавый, но годный.' },
  { id: 'mat_plastic', name: 'Пластик', price: 7, desc: 'Переработка бытового мусора.' },
  { id: 'mat_glass', name: 'Стекло', price: 9, desc: 'Осколки и линзы.' },
  { id: 'mat_rubber', name: 'Резина', price: 10, desc: 'Покрышки, сапоги, уплотнители.' },
  { id: 'mat_electronics', name: 'Электроника', price: 45, desc: 'Платы, чипы, провода.' },
  { id: 'mat_leather', name: 'Кожа', price: 25, desc: 'Чемоданы и ремни.' },
  { id: 'mat_silver', name: 'Серебро', price: 120, desc: 'Драгоценный металл.' },
  { id: 'mat_gold', name: 'Золото', price: 260, desc: 'Драгоценный металл.' },
  { id: 'mat_gem', name: 'Самоцветы', price: 400, desc: 'Огранённые камни.' },
  { id: 'mat_pearl', name: 'Жемчуг', price: 300, desc: 'Из раковин и украшений.' },
  { id: 'mat_ancient', name: 'Древний сплав', price: 900, desc: 'Не плавится обычными методами.' },
  { id: 'mat_crystal', name: 'Кристалл', price: 1400, desc: 'Инопланетная структура.' },
  { id: 'mat_blueprint', name: 'Чертёж', price: 2500, desc: 'Схема, открывающая рецепт.' },
  { id: 'mat_void_shard', name: 'Осколок пустоты', price: 9000, desc: 'Из материи, которой не должно быть.' },
];
export const MAT_BY_ID: Record<string, MaterialDef> = Object.fromEntries(MATERIALS.map((m) => [m.id, m]));

// ─────────────────────────────── РЕЦЕПТЫ ───────────────────────────────
export interface Recipe { id: string; out: string; kind: 'gear' | 'material'; qty: number; cost: number; need: [string, number][]; level: number; desc: string }
export const RECIPES: Recipe[] = [
  { id: 'r_fiber', out: 'rod_fiberglass', kind: 'gear', qty: 1, cost: 300, need: [['mat_wood', 8], ['mat_metal', 6], ['mat_plastic', 4]], level: 3, desc: 'Собрать стеклопластиковую удочку из подручного.' },
  { id: 'r_carbon', out: 'rod_carbon', kind: 'gear', qty: 1, cost: 2400, need: [['mat_wood', 10], ['mat_metal', 20], ['mat_electronics', 6]], level: 7, desc: 'Карбон из переработанных материалов.' },
  { id: 'r_treasure_rod', out: 'rod_treasure', kind: 'gear', qty: 1, cost: 9000, need: [['mat_metal', 40], ['mat_gold', 8], ['mat_blueprint', 1]], level: 11, desc: 'Кладоискатель: нужен чертёж.' },
  { id: 'r_monster_rod', out: 'rod_monster', kind: 'gear', qty: 1, cost: 24000, need: [['mat_metal', 80], ['mat_ancient', 6], ['mat_blueprint', 2]], level: 15, desc: 'Голиаф для гигантов.' },
  { id: 'r_abyss_rod', out: 'rod_abyss', kind: 'gear', qty: 1, cost: 70000, need: [['mat_ancient', 20], ['mat_crystal', 8], ['mat_void_shard', 1]], level: 19, desc: 'Бездна-удочка.' },
  { id: 'r_line30', out: 'line_30', kind: 'gear', qty: 1, cost: 3200, need: [['mat_plastic', 30], ['mat_rubber', 10]], level: 9, desc: 'Плетёнка 30 кг.' },
  { id: 'r_line70', out: 'line_70', kind: 'gear', qty: 1, cost: 12000, need: [['mat_plastic', 60], ['mat_metal', 30]], level: 13, desc: 'Плетёнка 70 кг.' },
  { id: 'r_line160', out: 'line_160', kind: 'gear', qty: 1, cost: 40000, need: [['mat_metal', 120], ['mat_ancient', 8]], level: 18, desc: 'Трос 160 кг.' },
  { id: 'r_servo', out: 'reel_servo', kind: 'gear', qty: 1, cost: 11000, need: [['mat_electronics', 24], ['mat_metal', 30]], level: 12, desc: 'Сервокатушка.' },
  { id: 'r_abyssreel', out: 'reel_abyss', kind: 'gear', qty: 1, cost: 38000, need: [['mat_ancient', 12], ['mat_electronics', 40]], level: 17, desc: 'Катушка «Левиафан».' },
  { id: 'r_hookgiant', out: 'hook_giant', kind: 'gear', qty: 1, cost: 22000, need: [['mat_metal', 60], ['mat_ancient', 4]], level: 14, desc: 'Усиленный крюк.' },
  { id: 'r_hookvoid', out: 'hook_void', kind: 'gear', qty: 1, cost: 100000, need: [['mat_void_shard', 3], ['mat_crystal', 12]], level: 22, desc: 'Крюк пустоты.' },
  { id: 'r_netgiant', out: 'net_giant', kind: 'gear', qty: 1, cost: 20000, need: [['mat_metal', 70], ['mat_rubber', 30]], level: 16, desc: 'Кран-подсачек.' },
  { id: 'r_boat_sub', out: 'boat_sub', kind: 'gear', qty: 1, cost: 40000, need: [['mat_metal', 100], ['mat_electronics', 30], ['mat_blueprint', 2]], level: 16, desc: 'Мини-субмарина.' },
  { id: 'r_bathyscaphe', out: 'boat_bathyscaphe', kind: 'gear', qty: 1, cost: 160000, need: [['mat_ancient', 30], ['mat_crystal', 20], ['mat_blueprint', 4]], level: 22, desc: 'Экспедиционный батискаф.' },
  { id: 'r_scanner', out: 'device_scanner', kind: 'gear', qty: 1, cost: 18000, need: [['mat_electronics', 35], ['mat_crystal', 4]], level: 17, desc: 'Сканер аномалий.' },
  { id: 'r_alien_rod', out: 'rod_alien', kind: 'gear', qty: 1, cost: 180000, need: [['mat_crystal', 30], ['mat_void_shard', 6], ['mat_blueprint', 5]], level: 24, desc: 'Резонансная удочка.' },
  { id: 'r_gold', out: 'mat_gold', kind: 'material', qty: 3, cost: 100, need: [['mat_silver', 5], ['mat_gem', 1]], level: 10, desc: 'Переплавить серебро и камень в золото.' },
  { id: 'r_ancient', out: 'mat_ancient', kind: 'material', qty: 2, cost: 200, need: [['mat_metal', 20], ['mat_crystal', 1]], level: 15, desc: 'Сплавить древний сплав.' },
  { id: 'r_glowbait', out: 'bait_glow', kind: 'material', qty: 5, cost: 200, need: [['mat_crystal', 1], ['mat_meat', 5]], level: 15, desc: 'Замешать светящуюся приманку.' },
  { id: 'r_alienbait', out: 'bait_alien', kind: 'material', qty: 3, cost: 800, need: [['mat_void_shard', 1], ['mat_meat', 10]], level: 21, desc: 'Аномальная приманка.' },
];

// ─────────────────────────────── ЛАБОРАТОРИЯ ───────────────────────────────
export interface ResearchResult { id: string; name: string; desc: string; need: string[]; hours: number; out: [string, number][]; unlock?: string }
export const RESEARCH: ResearchResult[] = [
  { id: 'res_crystal', name: 'Анализ кристалла', desc: 'Изучить инопланетную структуру и получить осколок пустоты.', need: ['fan_crystal'], hours: 2, out: [['mat_void_shard', 1], ['mat_crystal', 2]], unlock: 'Прорыв в материаловедении' },
  { id: 'res_orb', name: 'Резонанс сферы', desc: 'Настроить сферу: открывает детектор аномалий в магазине.', need: ['fan_orb'], hours: 4, out: [['mat_crystal', 5], ['mat_blueprint', 1]], unlock: 'device_scanner' },
  { id: 'res_device', name: 'Разбор прибора', desc: 'Экспериментальный прибор даёт чертежи нового оборудования.', need: ['tech_device_unknown'], hours: 6, out: [['mat_blueprint', 3], ['mat_electronics', 20]], unlock: 'Доступ к резонансной удочке' },
  { id: 'res_blackbox', name: 'Расшифровка чёрного ящика', desc: 'Записи указывают на затонувшую лабораторию.', need: ['tech_blackbox'], hours: 8, out: [['mat_blueprint', 2], ['mat_electronics', 30]], unlock: 'chain:sunken_lab' },
  { id: 'res_engine', name: 'Сборка древнего механизма', desc: 'Собранный механизм открывает датчик и подсказку к секретной зоне.', need: ['tre_part_mech', 'tre_part_mech', 'tre_part_mech'], hours: 12, out: [['mat_ancient', 10], ['mat_blueprint', 3]], unlock: 'chain:ancient_engine' },
  { id: 'res_safe', name: 'Вскрытие сейфа', desc: 'Внутри может быть что угодно. Обычно — что-то хорошее.', need: ['giant_safe'], hours: 10, out: [['mat_gold', 20], ['mat_gem', 5], ['mat_blueprint', 1]] },
  { id: 'res_container', name: 'Вскрытие контейнера', desc: 'Герметичная лабораторная тара. Внутри — образец.', need: ['tech_container'], hours: 5, out: [['mat_void_shard', 1], ['mat_meat', 20]] },
  { id: 'res_mask', name: 'Изучение маски', desc: 'Маска указывает путь к ещё не найденным экземплярам.', need: ['tre_mask'], hours: 14, out: [['mat_blueprint', 2], ['mat_gold', 10]], unlock: 'chain:sunken_door' },
  { id: 'res_heart', name: 'Слушать сердце', desc: 'Сердце озера бьётся. Это открывает портал.', need: ['fan_heart'], hours: 24, out: [['mat_void_shard', 10]], unlock: 'chain:portal' },
];

// ─────────────────────────────── СКУПЩИК ───────────────────────────────
export interface SmugglerOffer { id: string; give: [string, number][]; get: [string, number][]; limit: number; desc: string }
export const SMUGGLER_POOL: SmugglerOffer[] = [
  { id: 'sm_blueprint', give: [['mat_gem', 3]], get: [['mat_blueprint', 1]], limit: 3, desc: 'Чертёж за самоцветы.' },
  { id: 'sm_crystal', give: [['mat_ancient', 10]], get: [['mat_crystal', 3]], limit: 5, desc: 'Кристаллы за древний сплав.' },
  { id: 'sm_void', give: [['mat_crystal', 10], ['mat_gold', 20]], get: [['mat_void_shard', 1]], limit: 2, desc: 'Осколок пустоты — очень дорого.' },
  { id: 'sm_glowbait', give: [['mat_meat', 30], ['mat_gem', 1]], get: [['bait_glow', 5]], limit: 4, desc: 'Партия светящихся приманок.' },
  { id: 'sm_alienbait', give: [['mat_void_shard', 1]], get: [['bait_alien', 5]], limit: 3, desc: 'Аномальная приманка из-под полы.' },
  { id: 'sm_net', give: [['mat_metal', 100], ['mat_gold', 10]], get: [['net_giant', 1]], limit: 1, desc: 'Кран-подсачек без очереди.' },
  { id: 'sm_tracker', give: [['mat_electronics', 60]], get: [['device_tracker', 1]], limit: 1, desc: 'Биотрекер из закрытой партии.' },
  { id: 'sm_secret_coords', give: [['mat_void_shard', 2]], get: [['mat_blueprint', 3]], limit: 2, desc: 'Координаты секретных озёр (подсказки к событиям).' },
];

// ─────────────────────────────── ДОСТИЖЕНИЯ ───────────────────────────────
export interface AchievementDef { id: string; name: string; desc: string; check: string; reward: number }
export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'ach_first', name: 'Первый заброс', desc: 'Выловить что угодно.', check: 'lands>=1', reward: 50 },
  { id: 'ach_junk10', name: 'Мусорщик', desc: 'Выловить 10 предметов мусора.', check: 'cat:junk>=10', reward: 200 },
  { id: 'ach_junk50', name: 'Санитар озера', desc: 'Выловить 50 предметов мусора.', check: 'cat:junk>=50', reward: 1200 },
  { id: 'ach_fish25', name: 'Рыбак', desc: 'Выловить 25 рыб.', check: 'cat:fish>=25', reward: 300 },
  { id: 'ach_rare', name: 'Редкая находка', desc: 'Выловить предмет редкой редкости.', check: 'rarity:rare>=1', reward: 300 },
  { id: 'ach_epic', name: 'Эпический улов', desc: 'Выловить эпический предмет.', check: 'rarity:epic>=1', reward: 1000 },
  { id: 'ach_legend', name: 'Легенда озера', desc: 'Выловить легендарный предмет.', check: 'rarity:legendary>=1', reward: 5000 },
  { id: 'ach_mythic', name: 'Миф стал былью', desc: 'Выловить мифический предмет.', check: 'rarity:mythic>=1', reward: 25000 },
  { id: 'ach_secret', name: 'Это не должно было всплыть', desc: 'Выловить секретный предмет.', check: 'rarity:secret>=1', reward: 100000 },
  { id: 'ach_giant', name: 'Что-то огромное', desc: 'Пережить событие «Что-то огромное на крючке».', check: 'giants>=1', reward: 3000 },
  { id: 'ach_giant5', name: 'Охотник на гигантов', desc: 'Вытащить 5 огромных находок.', check: 'giants>=5', reward: 20000 },
  { id: 'ach_double', name: 'Двойная удача', desc: 'Поймать два предмета за один заброс.', check: 'doubles>=1', reward: 400 },
  { id: 'ach_break', name: 'Оборванная леска', desc: 'Потерять добычу из-за обрыва.', check: 'breaks>=1', reward: 100 },
  { id: 'ach_serial', name: 'Серийный номер', desc: 'Получить экземпляр из ограниченного тиража.', check: 'serials>=1', reward: 30000 },
  { id: 'ach_collect60', name: 'Каталогизатор', desc: 'Открыть 60 записей в музее.', check: 'museum>=60', reward: 10000 },
  { id: 'ach_collect110', name: 'Хранитель музея', desc: 'Открыть 110 записей в музее.', check: 'museum>=110', reward: 60000 },
  { id: 'ach_base', name: 'Своя база', desc: 'Разместить первый экспонат на базе.', check: 'exhibits>=1', reward: 500 },
  { id: 'ach_base10', name: 'Выставочный зал', desc: 'Разместить 10 экспонатов.', check: 'exhibits>=10', reward: 8000 },
  { id: 'ach_lvl10', name: 'Опытный рыбак', desc: 'Достичь 10 уровня.', check: 'level>=10', reward: 2000 },
  { id: 'ach_allloc', name: 'Весь мир на крючке', desc: 'Открыть все локации.', check: 'locs>=7', reward: 150000 },
];

// ─────────────────────────────── КОСМЕТИКА (Telegram Stars) ───────────────────────────────
export interface CosmeticDef { id: string; name: string; stars: number; kind: 'base_theme' | 'cast_fx' | 'float' | 'ui' | 'profile_frame' | 'season_pass'; desc: string; preview: Palette }
export const COSMETICS: CosmeticDef[] = [
  { id: 'cos_night_neon', name: 'Ночной неон', stars: 150, kind: 'base_theme', desc: 'Неоновая подсветка выставочного зала. Только внешний вид.', preview: ['#1a0f2e', '#00ffd5'] },
  { id: 'cos_underwater_bunker', name: 'Подводный бункер', stars: 200, kind: 'base_theme', desc: 'База под водой с иллюминаторами.', preview: ['#0a1a2a', '#57d0ff'] },
  { id: 'cos_cyber_harbor', name: 'Кибер-гавань', stars: 250, kind: 'base_theme', desc: 'Неоновые контейнеры и дроны.', preview: ['#101820', '#ff5f9a'] },
  { id: 'cos_research_station', name: 'Фантастическая станция', stars: 300, kind: 'base_theme', desc: 'Исследовательская станция с голограммами.', preview: ['#0b0b12', '#b46bff'] },
  { id: 'cos_aqua_gold', name: 'Золотые аквариумы', stars: 180, kind: 'base_theme', desc: 'Особые модели аквариумов и постаментов.', preview: ['#2a1f0a', '#ffb038'] },
  { id: 'cos_cast_ripple', name: 'Эффект заброса «Рябь»', stars: 90, kind: 'cast_fx', desc: 'Красивые круги при забросе. Не влияет на клёв.', preview: ['#0f3d52', '#bfe6ff'] },
  { id: 'cos_cast_void', name: 'Эффект заброса «Пустота»', stars: 240, kind: 'cast_fx', desc: 'Заброс разрывает пространство. Только визуал.', preview: ['#0b0b12', '#00ffd5'] },
  { id: 'cos_float_lantern', name: 'Поплавок-фонарь', stars: 120, kind: 'float', desc: 'Светящийся поплавок со световым следом.', preview: ['#1a2f1a', '#a8ff7a'] },
  { id: 'cos_float_crown', name: 'Поплавок «Корона»', stars: 200, kind: 'float', desc: 'Поплавок в виде короны. Никаких бонусов.', preview: ['#2a1f0a', '#ffb038'] },
  { id: 'cos_ui_deep', name: 'Тёмный интерфейс «Бездна»', stars: 160, kind: 'ui', desc: 'Альтернативное оформление интерфейса.', preview: ['#080d18', '#57a8ff'] },
  { id: 'cos_frame_angler', name: 'Рамка профиля «Удильщик»', stars: 80, kind: 'profile_frame', desc: 'Рамка с фонариком.', preview: ['#22262b', '#8affc9'] },
  { id: 'cos_frame_abyss', name: 'Рамка профиля «Бездна»', stars: 220, kind: 'profile_frame', desc: 'Анимированная глубокая рамка.', preview: ['#080d18', '#b46bff'] },
  { id: 'cos_pass_s1', name: 'Экспедиционный пропуск: Сезон 1', stars: 350, kind: 'season_pass', desc: 'Дополнительная линейка косметических наград сезона. Базовые награды остаются бесплатными.', preview: ['#1a2f4f', '#00ffd5'] },
];

// ─────────────────────────────── СЕЗОНЫ ───────────────────────────────
export interface SeasonDef { id: string; name: string; desc: string; endsAt: number; goals: { id: string; name: string; target: number; stat: string; reward: number }[] }
export const SEASON: SeasonDef = {
  id: 's1_abyss_expedition',
  name: 'Сезон 1 — Экспедиция в бездну',
  desc: 'Временная зона с экспериментальным батискафом. Прогресс экспедиции обнуляется, основная прокачка, коллекция и база — нет.',
  endsAt: Date.UTC(2026, 0, 1),
  goals: [
    { id: 'g1', name: 'Сделать 100 забросов в зоне экспедиции (бездна или инопланетное озеро)', target: 100, stat: 'expCasts', reward: 120 },
    { id: 'g2', name: 'Выловить 20 существ бездны', target: 20, stat: 'expCreatures', reward: 200 },
    { id: 'g3', name: 'Найти 3 обломка техники или фантастических объектов', target: 3, stat: 'expWrecks', reward: 260 },
    { id: 'g4', name: 'Победить гиганта экспедиции', target: 1, stat: 'expGiants', reward: 400 },
  ],
};

// ─────────────────────────────── ЦЕПОЧКИ НАХОДОК ───────────────────────────────
export interface ChainDef { id: string; name: string; steps: { need: string; hint: string; reward: [string, number][] }[] }
export const CHAINS: ChainDef[] = [
  {
    id: 'harbor_mystery', name: 'Тайна старой гавани',
    steps: [
      { need: 'junk_plate', hint: 'Номер с автомобиля указывает на конкретный причал.', reward: [['mat_metal', 5]] },
      { need: 'junk_watch', hint: 'Часы остановились в момент аварии. На задней крышке гравировка.', reward: [['mat_gold', 3]] },
      { need: 'junk_tv', hint: 'В телевизоре спрятана кассета с записью.', reward: [['mat_blueprint', 1]] },
      { need: 'junk_suitcase', hint: 'Чемодан открывается кодом из гравировки.', reward: [['tre_coin_gold', 5], ['mat_blueprint', 1]] },
    ],
  },
  {
    id: 'sunken_lab', name: 'Затонувшая лаборатория',
    steps: [
      { need: 'tech_battery', hint: 'Батарея всё ещё заряжена — значит, рядом есть источник.', reward: [['mat_electronics', 10]] },
      { need: 'tech_camera', hint: 'Камера снимала вход в лабораторию.', reward: [['mat_blueprint', 1]] },
      { need: 'junk_pc', hint: 'В компьютере журнал экспериментов.', reward: [['mat_blueprint', 1], ['mat_electronics', 15]] },
      { need: 'tech_container', hint: 'Контейнер с образцом открывает последнюю дверь.', reward: [['mat_void_shard', 1]] },
    ],
  },
  { id: 'ancient_engine', name: 'Древний механизм', steps: [
      { need: 'tre_part_mech', hint: 'Нужно три части одного механизма.', reward: [['mat_ancient', 3]] },
      { need: 'tre_part_mech', hint: 'Вторая часть найдена. Ищите третью.', reward: [['mat_ancient', 3]] },
      { need: 'tre_part_mech', hint: 'Механизм собран — он указывает на затонувший город.', reward: [['mat_blueprint', 2]] },
  ] },
  { id: 'safe_code', name: 'Код от сейфа', steps: [
      { need: 'giant_safe', hint: 'Сейф заперт. Нужен код.', reward: [['mat_metal', 20]] },
      { need: 'junk_plate', hint: 'Цифры на номере совпадают с комбинацией.', reward: [['mat_gold', 10]] },
  ] },
  { id: 'kraken', name: 'След кракена', steps: [
      { need: 'giant_kraken', hint: 'Кракен не один. Есть гнездо.', reward: [['mat_void_shard', 2]] },
  ] },
  { id: 'leviathan', name: 'Левиафан', steps: [
      { need: 'fish_leviathan_fry', hint: 'Детёныш указывает на взрослую особь.', reward: [['mat_crystal', 5]] },
      { need: 'giant_serpent', hint: 'Морской змей — лишь часть чего-то большего.', reward: [['mat_void_shard', 3]] },
      { need: 'giant_ark', hint: 'Ковчег найден. Внутри — дверь.', reward: [['mat_void_shard', 10]] },
  ] },
  { id: 'portal', name: 'Портал', steps: [
      { need: 'fan_portal_part', hint: 'Частица портала дрожит рядом с ядром.', reward: [['mat_crystal', 8]] },
      { need: 'fan_anomaly_core', hint: 'Ядро аномалии питает портал.', reward: [['mat_void_shard', 4]] },
      { need: 'giant_void_key', hint: 'Ключ от всего открывает то, что за порталом.', reward: [['mat_void_shard', 20]] },
  ] },
  { id: 'giant_catfish', name: 'Хозяин ямы', steps: [
      { need: 'giant_catfish', hint: 'Сом ушёл, но оставил след к своей яме.', reward: [['mat_meat', 30]] },
  ] },
];

// ─────────────────────────────── ГЛОБАЛЬНЫЕ СОБЫТИЯ ───────────────────────────────
// Событие недели выбирается детерминированно на сервере и реально влияет на таблицы добычи.
export interface GlobalEventDef {
  id: string; name: string; desc: string; loc?: string;
  rarityBias?: number; catBias?: Partial<Record<Category, number>>;
}
export const GLOBAL_EVENTS: GlobalEventDef[] = [
  { id: 'gold_wave', name: 'Золотая волна', desc: 'Временно повышается шанс найти ценные предметы во всех локациях.', rarityBias: 1.5 },
  { id: 'migration', name: 'Миграция', desc: 'В тропический океан прибыли редкие виды рыб.', loc: 'ocean', catBias: { fish: 1.9 } },
  { id: 'ghost_ship', name: 'Призрачный корабль', desc: 'В затонувшем городе появилась зона с необычной добычей.', loc: 'sunken', catBias: { treasure: 1.7, fantasy: 1.4 } },
  { id: 'giant_hunt', name: 'Охота на гиганта', desc: 'В бездне замечен огромный силуэт: шанс гигантской находки резко выше.', loc: 'abyss', catBias: { giant: 2.6 } },
  { id: 'unknown_signal', name: 'Неизвестный сигнал', desc: 'Сигнал ведёт к фантастическим находкам у инопланетного озера.', loc: 'alien', catBias: { fantasy: 2.2 } },
  { id: 'sunken_expedition', name: 'Затонувшая экспедиция', desc: 'В старой гавани ищут оборудование пропавших исследователей.', loc: 'harbor', catBias: { tech: 2.1 } },
  { id: 'time_rift', name: 'Временной разлом', desc: 'На лесном озере всплывают предметы из другой эпохи.', loc: 'lake', catBias: { treasure: 1.5, junk: 1.3 } },
  { id: 'festival', name: 'Фестиваль рыбалки', desc: 'Соревновательный период: рыба клюёт активнее, ограниченные коллекции.', catBias: { fish: 1.35 }, rarityBias: 1.25 },
];

export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

export function levelXp(level: number): number {
  return Math.floor(120 * Math.pow(level, 1.85));
}
export function levelFromXp(xp: number): number {
  let lvl = 1;
  while (lvl < 60 && xp >= levelXp(lvl)) { xp -= levelXp(lvl); lvl++; }
  return lvl;
}
export function xpInLevel(xp: number): { level: number; cur: number; need: number } {
  let lvl = 1;
  while (lvl < 60 && xp >= levelXp(lvl)) { xp -= levelXp(lvl); lvl++; }
  return { level: lvl, cur: xp, need: levelXp(lvl) };
}
export function weekIndex(ts = Date.now()): number { return Math.floor(ts / WEEK_MS); }
export function dayKey(ts = Date.now()): string { return new Date(ts).toISOString().slice(0, 10); }
