const BASE_URL = "https://luzifersenpai.github.io/tradeListGenerator";
const RARITIES = ["C Pocket", "U Pocket", "R Pocket", "RR Pocket", "SA Pocket", "SSASR Pocket", "S Pocket", "SSR Pocket"];
const rarityToDiscordSymbol = {
    "C Pocket": ":small_blue_diamond:",
    "U Pocket": ":small_blue_diamond::small_blue_diamond:",
    "R Pocket": ":small_blue_diamond::small_blue_diamond::small_blue_diamond:",
    "RR Pocket": ":small_blue_diamond::small_blue_diamond::small_blue_diamond::small_blue_diamond:",
    "SA Pocket": ":star:",
    "SSASR Pocket": ":star::star:",
    "S Pocket": ":star2:",
};

const tradeListAtom = atom({ wants: [], haves: [] }, "tradelist");
const fields = {
    want: {
        storageKey: "needsFilter",
        wrapperId: "need-sets-accordions",
        inputId: "needs-name-filter",
        labelId: "needs-rarity-label",
        menuId: "needs-rarity-menu",
    },
    have: {
        storageKey: "haveFilter",
        wrapperId: "have-sets-accordions",
        inputId: "have-name-filter",
        labelId: "have-rarity-label",
        menuId: "have-rarity-menu",
    },
};

let rarityOrder = [];
let wishlist = [];

Object.values(fields).forEach(cfg => {
    cfg.filterAtom = atom({ name: "", rarity: "all" }, cfg.storageKey);
    cfg.setsAtom = atom([]);
    cfg.allSets = [];
    cfg.setName = debounce(name => cfg.filterAtom.set(old => ({ ...old, name })));
});

function atom(initialValue, storageKey) {
    const listeners = new Set();
    let value = storageKey
        ? JSON.parse(localStorage.getItem(storageKey) ?? "null") ?? initialValue
        : initialValue;

    return {
        get: () => value,
        set: (next) => {
            value = typeof next === "function" ? next(value) : next;

            if (storageKey) localStorage.setItem(storageKey, JSON.stringify(value));

            listeners.forEach(fn => fn(value));
        },
        subscribe: (fn) => {
            listeners.add(fn);

            fn(value);

            return () => listeners.delete(fn);
        }
    };
}

function debounce(fn, delay = 300) {
    let timer;

    return (...args) => {
        clearTimeout(timer);

        timer = setTimeout(() => fn(...args), delay);
    };
}

function showToast(message, type = "alert-success") {
    const toast = document.getElementById("toast");
    const newAlert = document.createElement("div");

    newAlert.className = `alert ${type}`;
    newAlert.innerHTML = `<span>${message}</span>`;

    toast.appendChild(newAlert);

    setTimeout(() => newAlert.remove(), 3000);
}

function raritySrc(rarity) {
    return `${BASE_URL}/rarities/${encodeURIComponent(rarity)}.png`;
}

function setKey(set) {
    return `${set.symbol} - ${set.name}`;
}

function cardSrc(setName, card) {
    return `${BASE_URL}/sets/${setName}/${String(card.index).padStart(3, "0")}.png`;
}

function setNameFilter(field, event) {
    fields[field].setName(event.target.value.toLowerCase());
}

function setRarity(field, rarity) {
    fields[field].filterAtom.set(old => ({ ...old, rarity }));

    document.activeElement.blur();
}

function addToTrade(setName, card, field) {
    const key = `${field}s`;
    const max = (wishlist[setName] ?? []).find(c => c.index === card.index)?.[field] ?? 0;
    const current = tradeListAtom.get()[key].filter(e => e.setName === setName && e.card.index === card.index).length;

    if (current >= max) {
        showToast(`Bereits ${max}× hinzugefügt`, "alert-warning");

        return;
    }

    tradeListAtom.set(old => ({ ...old, [key]: [...old[key], { setName, card }] }));

    showToast(`${card.name} zur Tauschliste hinzugefügt.`);
}

function removeFromTrade(field, index) {
    const key = `${field}s`;

    tradeListAtom.set(old => ({
        ...old,
        [key]: old[key].filter((_, i) => i !== index)
    }));
}

function tradeEntryElement(entry, field, occurrence) {
    const element = document.createElement("div");

    element.className = "flex p-2 flex-col gap-2 bg-base-300 cursor-pointer";
    element.innerHTML = `
        <img class="card-img" src="${cardSrc(entry.setName, entry.card)}">
        <div class="flex flex-col">
            <span class="text-sm font-semibold truncate">${entry.card.name}</span>
            <span class="text-xs opacity-50 truncate">${entry.setName}</span>
        </div>
    `;

    element.addEventListener("click", () => removeFromTrade(field, occurrence));

    return element;
}

function renderSets(wrapperId, sets, field) {
    const wrapper = document.getElementById(wrapperId);
    const visibleSetNames = new Set(sets.map(setKey));

    wrapper.querySelectorAll(".set-accordion").forEach(accordion => {
        if (!visibleSetNames.has(accordion.name)) accordion.classList.add("hidden!");
    });

    sets.forEach(set => {
        const setName = setKey(set);
        let accordion = wrapper.querySelector(`.set-accordion[name="${setName}"]`);

        if (!accordion) {
            accordion = document.createElement("details");
            accordion.name = setName;
            accordion.className = "set-accordion collapse join-item border border-border";
            accordion.innerHTML = `
                <summary class="collapse-title cursor-pointer font-semibold">${setName}</summary>
                <div class="set-accordion-content collapse-content grid w-full h-fit justify-center gap-4"></div>
            `;

            wrapper.appendChild(accordion);
        }

        const content = accordion.querySelector(".set-accordion-content");
        const visibleCardIds = new Set(set.cards.map(c => String(c.index)));

        accordion.classList.toggle("hidden!", visibleCardIds.size === 0);

        content.querySelectorAll(".card-display").forEach(cardDisplay => {
            cardDisplay.classList.toggle("hidden!", !visibleCardIds.has(cardDisplay.dataset.cardId));
        });

        set.cards.forEach(card => {
            if (content.querySelector(`.card-display[data-card-id="${card.index}"]`)) return;

            const entry = (wishlist[setName] ?? []).find(c => c.index === card.index);
            const cardWrapper = document.createElement("div");

            cardWrapper.dataset.cardId = card.index;
            cardWrapper.className = "card-display flex relative flex-col gap-2 cursor-pointer";
            cardWrapper.innerHTML = `
                <img class="card-img" src="${cardSrc(setName, card)}" />
                <span class="absolute bottom-0 right-0 badge px-2 mb-1 mr-1">${entry[field]}</span>
            `;

            cardWrapper.addEventListener("click", () => addToTrade(setName, card, field));

            content.appendChild(cardWrapper);
        });
    });
}

function renderTradeColumn(column, entries, rarity, field) {
    column.innerHTML = "";

    entries
        .filter(e => e.card.rarity === rarity)
        .forEach(entry => column.appendChild(tradeEntryElement(entry, field, entries.indexOf(entry))));
}

function renderTradeList({ wants, haves }) {
    const tradeGrid = document.getElementById("trade-list");
    const tradeListInput = document.getElementById("trade-list-input");
    const isEmpty = wants.length === 0 && haves.length === 0;

    tradeListInput.classList.toggle("tab-disabled", isEmpty);

    if (isEmpty && tradeListInput.checked) {
        document.getElementById("want-input").checked = "checked";
    }

    rarityOrder.forEach(rarity => {
        const hasCards = wants.some(e => e.card.rarity === rarity) || haves.some(e => e.card.rarity === rarity);
        let section = tradeGrid.querySelector(`.trade-rarity-section[data-rarity="${rarity}"]`);

        if (!section) {
            section = document.createElement("div");
            section.dataset.rarity = rarity;
            section.className = "trade-rarity-section flex flex-col gap-2";
            section.innerHTML = `
                <div class="divider-grid grid gap-4">
                    <div class="divider divider-end pl-0">Habe</div>
                    <div class="divider">
                        <img src="${raritySrc(rarity)}" class="h-3 object-contain">
                    </div>
                    <div class="divider divider-start pr-0">Brauche</div>
                </div>
                <div class="grid grid-cols-2 gap-2">
                    <div class="trade-wants flex flex-col gap-2"></div>
                    <div class="trade-haves flex flex-col gap-2"></div>
                </div>
            `;

            tradeGrid.appendChild(section);
        }

        section.classList.toggle("hidden!", !hasCards);

        renderTradeColumn(section.querySelector(".trade-wants"), wants, rarity, "want");
        renderTradeColumn(section.querySelector(".trade-haves"), haves, rarity, "have");
    });
}

function generateExport() {
    const { wants, haves } = tradeListAtom.get();
    const cardNames = (entries, rarity) => entries
        .filter(e => e.card.rarity === rarity)
        .map(e => `${e.card.name} (${e.setName.split(" - ")[0]})`)
        .join(", ");

    const text = rarityOrder
        .filter(rarity => wants.some(e => e.card.rarity === rarity) || haves.some(e => e.card.rarity === rarity))
        .map(rarity => [
            `- ${rarityToDiscordSymbol[rarity]}:`,
            `  - Habe: ${cardNames(wants, rarity)}`,
            `  - Brauche: ${cardNames(haves, rarity)}`,
        ].join("\n"))
        .join("\n\n");

    document.getElementById("export-field").value = text;

    navigator.clipboard.writeText(text).then(() => showToast("In die Zwischenablage kopiert!"));
}

function rarityMenuItems(field) {
    return [
        `<li><a class="text-sm" onclick="setRarity('${field}', 'all')">Alle</a></li>`,
        ...RARITIES.map(rarity => `<li><a onclick="setRarity('${field}', '${rarity}')"><img src="${raritySrc(rarity)}" class="h-3 object-contain"></a></li>`)
    ].join("");
}

document.addEventListener("DOMContentLoaded", async () => {
    const [wishlistJSON, setsJSON, tradeableJSON] = await Promise.all([
        fetch("./wishlist.json").then(r => r.json()),
        fetch(`${BASE_URL}/sets.json`).then(r => r.json()),
        fetch(`${BASE_URL}/currentlyTradeable.json`).then(r => r.json())
    ]);
    const allSets = setsJSON.map(set => set.cards ? { ...set, cards: set.cards.filter(card => tradeableJSON.includes(card.rarity)) } : set);

    rarityOrder = tradeableJSON;
    wishlist = wishlistJSON;

    tradeListAtom.subscribe(renderTradeList);

    Object.entries(fields).forEach(([field, cfg]) => {
        const rarityLabel = document.getElementById(cfg.labelId);

        document.getElementById(cfg.menuId).innerHTML = rarityMenuItems(field);
        document.getElementById(cfg.inputId).value = cfg.filterAtom.get().name;

        cfg.allSets = allSets
            .map(set => {
                const wishedCards = wishlist[setKey(set)] ?? [];

                return {
                    ...set,
                    cards: (set.cards ?? []).filter(card => wishedCards.find(c => c.index === card.index)?.[field] > 0)
                };
            })
            .filter(set => set.cards.length > 0);

        cfg.setsAtom.subscribe(sets => renderSets(cfg.wrapperId, sets, field));
        cfg.filterAtom.subscribe(({ name, rarity }) => {
            rarityLabel.innerHTML = rarity === "all" ? "Alle" : `<img src="${raritySrc(rarity)}" class="h-3 object-contain">`;

            cfg.setsAtom.set(cfg.allSets.map(set => ({
                ...set,
                cards: set.cards.filter(card => card.name.toLowerCase().includes(name) && (rarity === "all" || card.rarity === rarity))
            })));
        });
    });
});
