// ============================================
// HODEKAI - PERMISSIONS
// ============================================

const config = require("./config");

function clean(number) {
    if (!number) return "";

    return String(number)
        .replace("@s.whatsapp.net", "")
        .replace("@c.us", "")
        .replace(/\D/g, "");
}

function matches(number, list) {
    const n = clean(number);

    return list.some(x => {
        const c = clean(x);

        return (
            n === c ||
            n.endsWith(c) ||
            c.endsWith(n)
        );
    });
}

function isFather(number) {
    return matches(number, config.FATHER_NUMBERS);
}

function isCoCreator(number) {
    return matches(number, config.CO_CREATOR_NUMBERS);
}

function isMod(number) {
    return matches(number, config.MOD_NUMBERS);
}

function isOwner(number) {
    return isFather(number) || isCoCreator(number);
}

function getRole(number) {
    if (isFather(number)) return "FATHER";
    if (isCoCreator(number)) return "CO_CREATOR";
    if (isMod(number)) return "MOD";
    return "CITIZEN";
}

function getRank(number) {
    if (isFather(number)) return 4;
    if (isCoCreator(number)) return 3;
    if (isMod(number)) return 2;
    return 1;
}

function isProtected(number) {
    return isOwner(number) || isMod(number);
}

function canManageMods(number) {
    return isFather(number) || isCoCreator(number);
}

function canModerate(requester, target) {
    return getRank(requester) > getRank(target);
}

module.exports = {
    clean,
    isFather,
    isCoCreator,
    isMod,
    isOwner,
    getRole,
    getRank,
    isProtected,
    canManageMods,
    canModerate
};
