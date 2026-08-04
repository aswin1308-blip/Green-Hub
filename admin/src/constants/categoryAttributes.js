export const CATEGORY_ATTRIBUTES = {
  seeds: [
    {
      key: "germinationTime",
      label: "Germination time",
      type: "text",
      placeholder: "e.g. 7-14 days",
    },
    {
      key: "seedType",
      label: "Seed type",
      type: "select",
      options: ["hybrid", "organic", "heirloom"],
    },
    {
      key: "packetWeight",
      label: "Packet weight",
      type: "text",
      placeholder: "e.g. 50 g",
    },
    {
      key: "sowingSeason",
      label: "Sowing season",
      type: "text",
      placeholder: "e.g. Spring / Monsoon",
    },
  ],

  fruits: [
    {
      key: "shelfLife",
      label: "Shelf life",
      type: "text",
      placeholder: "e.g. 7 days",
    },
    {
      key: "ripeness",
      label: "Ripeness",
      type: "text",
      placeholder: "e.g. Ready to eat",
    },
    {
      key: "organicCertified",
      label: "Organic certified",
      type: "select",
      options: ["yes", "no"],
    },
    {
      key: "unit",
      label: "Unit",
      type: "select",
      options: ["kg", "piece"],
    },
  ],

  plants: [
    {
      key: "potSize",
      label: "Pot size",
      type: "text",
      placeholder: "e.g. 6 inch",
    },
    {
      key: "sunlightNeeds",
      label: "Sunlight needs",
      type: "text",
      placeholder: "e.g. Full sun / Partial shade",
    },
    {
      key: "wateringFrequency",
      label: "Watering frequency",
      type: "text",
      placeholder: "e.g. Twice a week",
    },
    {
      key: "matureHeight",
      label: "Mature height",
      type: "text",
      placeholder: "e.g. 2-3 ft",
    },
    {
      key: "indoorOrOutdoor",
      label: "Indoor or outdoor",
      type: "select",
      options: ["indoor", "outdoor"],
    },
  ],
};

export const FIELD_TYPE_LABELS = {
  germinationTime: "Germination time",
  seedType: "Seed type",
  packetWeight: "Packet weight",
  sowingSeason: "Sowing season",
  shelfLife: "Shelf life",
  ripeness: "Ripeness",
  organicCertified: "Organic certified",
  unit: "Unit",
  potSize: "Pot size",
  sunlightNeeds: "Sunlight needs",
  wateringFrequency: "Watering frequency",
  matureHeight: "Mature height",
  indoorOrOutdoor: "Indoor or outdoor",
};

export function attributeFields(slug) {
  return CATEGORY_ATTRIBUTES[slug] || [];
}