export const examples = Object.freeze([
  { input: "The workshop pump stopped running. Please send someone to fix it.", expected: "maintenance" },
  { input: "The entrance door will not close because its hinge is broken.", expected: "maintenance" },
  { input: "The replacement parts shipment has not arrived. Please check its delivery status.", expected: "delivery" },
  { input: "Our parcel arrived with two ordered items missing.", expected: "delivery" },
  { input: "Arrange a routine condition survey of the site; no repair is requested.", expected: "inspection" },
  { input: "Complete the scheduled equipment checklist and record the readings.", expected: "inspection" },
  { input: "Please change the bank account used for my salary.", expected: "review" },
  { input: "Repair the pump and separately track our missing parcel.", expected: "review" },
  { input: "Please handle this for us.", expected: "review" },
]);