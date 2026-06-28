const BASE_URL = "https://luzifersenpai.github.io/tradeListGenerator";
const tradeListAtom = atomWithStorage("tradelist", { wants: [], haves: [] });
const needsFilterAtom = atomWithStorage("needsFilter", { name: "", rarity: "all" });
const haveFilterAtom = atomWithStorage("haveFilter", { name: "", rarity: "all" });
const needSetsAtom = atom([]);
const haveSetsAtom = atom([]);
const rarityToDiscordSymbol = {
    "C Pocket": ":small_blue_diamond:",
    "U Pocket": ":small_blue_diamond::small_blue_diamond:",
    "R Pocket": ":small_blue_diamond::small_blue_diamond::small_blue_diamond:",
    "RR Pocket": ":small_blue_diamond::small_blue_diamond::small_blue_diamond::small_blue_diamond:",
    "SA Pocket": ":star:",
    "SSASR Pocket": ":star::star:",
    "S Pocket": ":star2:",
};

let rarityOrder = [];
let allNeedsSets = [];
let allHaveSets = [];
let wishlist = [];

function atomWithStorage(key, initialValue) {
    const listeners = new Set();
    let value = JSON.parse(localStorage.getItem(key) ?? 'null') ?? initialValue;

    return {
        get: () => value,
        set: (next) => {
            value = typeof next === 'function' ? next(value) : next;

            localStorage.setItem(key, JSON.stringify(value));
            listeners.forEach(fn => fn(value));
        },
        subscribe: (fn) => {
            listeners.add(fn);

            fn(value);

            return () => listeners.delete(fn);
        }
    };
}

function atom(initialValue) {
    const listeners = new Set();
    let value = initialValue;

    return {
        get: () => value,
        set: (next) => {
            value = typeof next === 'function' ? next(value) : next;

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

    newAlert.classList.add("alert", type, "rounded-2xl");
    newAlert.innerHTML = `<span>${message}</span>`;

    toast.appendChild(newAlert);

    setTimeout(() => newAlert.remove(), 3000);
}

function raritySrc(rarity) {
    return `${BASE_URL}/rarities/${encodeURIComponent(rarity)}.png`;
}

const setNeedsNameFilter = debounce(e => needsFilterAtom.set(oldFilter => ({ ...oldFilter, name: e.target.value.toLowerCase() })), 300);
const setHaveNameFilter = debounce(e => haveFilterAtom.set(oldFilter => ({ ...oldFilter, name: e.target.value.toLowerCase() })), 300);

function setNeedsRarity(rarity) {
    needsFilterAtom.set(oldFilter => ({ ...oldFilter, rarity }));

    document.activeElement.blur();
}

function setHaveRarity(rarity) {
    haveFilterAtom.set(oldFilter => ({ ...oldFilter, rarity }));

    document.activeElement.blur();
}

function addToTrade(setName, card, field) {
    const key = field === "want" ? "wants" : "haves";
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
    const key = field === "want" ? "wants" : "haves";

    tradeListAtom.set(old => ({
        ...old,
        [key]: old[key].filter((_, i) => i !== index)
    }));
}

function tradeEntryElement(entry, field, occurrence) {
    const element = document.createElement("div");

    element.className = "flex p-2 flex-col gap-2 bg-base-200 rounded-2xl cursor-pointer";
    element.innerHTML = `
        <img class="card-img" src="${BASE_URL}/sets/${entry.setName}/${String(entry.card.index).padStart(3, "0")}.png">
        <div class="flex flex-col">
            <span class="text-sm font-semibold truncate">${entry.card.name}</span>
            <span class="text-xs opacity-50 truncate">${entry.setName}</span>
        </div>
    `;

    element.addEventListener("click", () =>
        removeFromTrade(field, occurrence)
    );

    return element;
}

function renderSets(wrapperId, sets, field) {
    const wrapper = document.getElementById(wrapperId);
    const getCount = field === "want" ? e => e.want : e => e.have;
    const visibleSetNames = new Set(sets.map(set => `${set.symbol} - ${set.name}`));

    wrapper.querySelectorAll(".set-accordion").forEach(accordion => {
        if (!visibleSetNames.has(accordion.name)) accordion.classList.add("hidden!");
    });

    sets.forEach(set => {
        const setName = `${set.symbol} - ${set.name}`;
        let accordion = wrapper.querySelector(`.set-accordion[name="${setName}"]`);

        if (!accordion) {
            accordion = document.createElement("details");
            accordion.name = setName;
            accordion.classList = "set-accordion collapse join-item border-base-300 border";
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

            const wishedCards = wishlist[setName] ?? [];
            const entry = wishedCards.find(c => c.index === card.index);
            const cardWrapper = document.createElement("div");

            cardWrapper.dataset.cardId = card.index;
            cardWrapper.classList = "card-display flex relative flex-col gap-2 cursor-pointer"
            cardWrapper.innerHTML = `
                <img class="card-img" src="${BASE_URL}/sets/${setName}/${String(card.index).padStart(3, "0")}.png" />
                <span class="absolute bottom-0 right-0 badge badge-accent mb-1 mr-1 rounded-xl">${getCount(entry)}</span>
            `;

            cardWrapper.addEventListener("click", () => addToTrade(setName, card, field));

            content.appendChild(cardWrapper);
        });
    });
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
        const rarityWants = wants.filter(e => e.card.rarity === rarity);
        const rarityHaves = haves.filter(e => e.card.rarity === rarity);
        const hasCards = rarityWants.length > 0 || rarityHaves.length > 0;
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

        const wantsCol = section.querySelector(".trade-wants");
        const havesCol = section.querySelector(".trade-haves");

        wantsCol.innerHTML = "";
        havesCol.innerHTML = "";

        rarityWants.forEach((entry, i) => {
            const occurrence = wants.indexOf(entry);

            wantsCol.appendChild(tradeEntryElement(entry, "want", occurrence));
        });
        rarityHaves.forEach((entry, i) => {
            const occurrence = haves.indexOf(entry);

            havesCol.appendChild(tradeEntryElement(entry, "have", occurrence));
        });
    });
}

function generateExport() {
    const { wants, haves } = tradeListAtom.get();

    const text = rarityOrder
        .filter(rarity => wants.some(e => e.card.rarity === rarity) || haves.some(e => e.card.rarity === rarity))
        .map(rarity => {
            const rarityWants = wants.filter(e => e.card.rarity === rarity);
            const rarityHaves = haves.filter(e => e.card.rarity === rarity);

            const wantStr = rarityWants.map(e => `${e.card.name} (${e.setName.split(" - ")[0]})`).join(", ");
            const haveStr = rarityHaves.map(e => `${e.card.name} (${e.setName.split(" - ")[0]})`).join(", ");

            return [
                `- ${rarityToDiscordSymbol[rarity]}:`,
                `  - Habe: ${wantStr}`,
                `  - Brauche: ${haveStr}`,
            ].join("\n");
        })
        .join("\n\n");

    document.getElementById("export-field").value = text;
    navigator.clipboard.writeText(text).then(() => showToast("In die Zwischenablage kopiert!"))
}

document.addEventListener("DOMContentLoaded", async () => {
    document.querySelectorAll(".dropdown-content > li > a > img").forEach(img => img.src = raritySrc(img.dataset.rarity));
    document.getElementById("needs-name-filter").value = needsFilterAtom.get().name;
    document.getElementById("have-name-filter").value = haveFilterAtom.get().name;

    const needsRarityDisplay = document.getElementById("needs-rarity-display");
    const haveRarityDisplay = document.getElementById("have-rarity-display");
    const [wishlistJSON, setsJSON, tradeableJSON] = await Promise.all([
        fetch("./wishlist.json").then(r => r.json()),
        fetch(`${BASE_URL}/sets.json`).then(r => r.json()),
        fetch(`${BASE_URL}/currentlyTradeable.json`).then(r => r.json())
    ]);
    const allSets = setsJSON.map(set => set.cards ? { ...set, cards: set.cards.filter(card => tradeableJSON.includes(card.rarity)) } : set);

    rarityOrder = tradeableJSON;
    wishlist = wishlistJSON;
    allNeedsSets = allSets
        .map(set => {
            const setName = `${set.symbol} - ${set.name}`;
            const wishedCards = wishlist[setName] ?? [];

            return {
                ...set,
                cards: (set.cards ?? []).filter(card => {
                    const entry = wishedCards.find(c => c.index === card.index);

                    return entry && entry.want > 0;
                })
            };
        })
        .filter(set => set.cards.length > 0)
    allHaveSets = allSets
        .map(set => {
            const setName = `${set.symbol} - ${set.name}`;
            const wishedCards = wishlist[setName] ?? [];

            return {
                ...set,
                cards: (set.cards ?? []).filter(card => {
                    const entry = wishedCards.find(c => c.index === card.index);

                    return entry && entry.have > 0;
                })
            };
        })
        .filter(set => set.cards.length > 0)

    needSetsAtom.subscribe(sets => renderSets("need-sets-accordions", sets, "want"));
    haveSetsAtom.subscribe(sets => renderSets("have-sets-accordions", sets, "have"));
    tradeListAtom.subscribe(renderTradeList);

    needSetsAtom.set(allNeedsSets);
    needSetsAtom.set(allHaveSets);

    needsFilterAtom.subscribe(({ name, rarity }) => {
        if (rarity === "all") needsRarityDisplay.innerHTML = "Alle";
        else needsRarityDisplay.innerHTML = `<img src="${raritySrc(rarity)}" class="h-3 object-contain">`;

        needSetsAtom.set(allNeedsSets.map(set => set.cards ? { ...set, cards: set.cards.filter(card => card.name.toLowerCase().includes(name) && (rarity === "all" || card.rarity === rarity)) } : set));
    });
    haveFilterAtom.subscribe(({ name, rarity }) => {
        if (rarity === "all") haveRarityDisplay.innerHTML = "Alle";
        else haveRarityDisplay.innerHTML = `<img src="${raritySrc(rarity)}" class="h-3 object-contain">`;

        haveSetsAtom.set(allHaveSets.map(set => set.cards ? { ...set, cards: set.cards.filter(card => card.name.toLowerCase().includes(name) && (rarity === "all" || card.rarity === rarity)) } : set));
    });
});