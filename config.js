// ============================================
// HODEKAI V5.0 - CONFIGURATION
// ============================================

module.exports = {
    PREFIX: ":",

    PORT: process.env.PORT || 3000,

    // DO NOT CHANGE THIS NUMBER
    BOT_NUMBER: process.env.BOT_NUMBER || "256775032199",

    BOT_NAME: "Hodekai",
    BOT_VERSION: "5.0.0",

    RESPONSE_DELAY: 3000,

    FATHER_NUMBERS: [
        "263787876771",
        "0787876771",
        "787876771"
    ],

    CO_CREATOR_NUMBERS: [
        "263717306869",
        "0717306869",
        "717306869"
    ],

    MOD_NUMBERS: [
        "2348123885002",
        "2349168527304",
        "256795955270",
        "2347031331295"
    ],

    OWNERS: {
        FATHER: "263787876771",
        CO_CREATOR: "263717306869"
    },

    COMPANY_TAX: 0.15,
    USER_TAX: 0.05,

    LOAN_INTEREST: 0.001,
    BANK_INTEREST: 0.001,

    BANKRUPTCY: 500000,
    COMPANY_MIN: 10000,

    TAGALL_COOLDOWN: 300000,
    CHEQUE_EXPIRY: 172800000,
    CHEQUE_COOLDOWN: 10000,

    DATA_FILE: "./data/conclave_data.json",
    AUTH_DIR: "./auth_info_baileys_v11"
};
