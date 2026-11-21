/**
 * A built-in list of cars common in Canada. The picker uses the server's catalogue first; this list is the fallback for when the
 * server cannot be reached (or has nothing for what was typed), so a driver can always find their car while signing up.
 */
const CATALOG: Record<string, string[]> = {
  Toyota: ['Camry', 'Corolla', 'RAV4', 'Highlander', 'Prius', 'Sienna', 'Tacoma', 'Tundra', 'Yaris', 'Avalon', '4Runner', 'C-HR', 'Venza', 'Corolla Cross', 'Sequoia', 'bZ4X', 'Crown', 'Grand Highlander'],
  Honda: ['Civic', 'Accord', 'CR-V', 'HR-V', 'Pilot', 'Odyssey', 'Fit', 'Ridgeline', 'Passport', 'Insight', 'Prologue'],
  Hyundai: ['Elantra', 'Sonata', 'Tucson', 'Santa Fe', 'Kona', 'Venue', 'Palisade', 'Ioniq 5', 'Ioniq 6', 'Accent', 'Santa Cruz', 'Ioniq'],
  Kia: ['Forte', 'K5', 'Optima', 'Sportage', 'Sorento', 'Seltos', 'Soul', 'Telluride', 'Carnival', 'Niro', 'Rio', 'EV6', 'Stinger', 'Sedona', 'EV9'],
  Nissan: ['Altima', 'Sentra', 'Rogue', 'Versa', 'Murano', 'Pathfinder', 'Kicks', 'Frontier', 'Qashqai', 'Leaf', 'Maxima', 'Micra', 'Armada', 'Ariya'],
  Mazda: ['Mazda3', 'Mazda6', 'CX-3', 'CX-30', 'CX-5', 'CX-50', 'CX-9', 'CX-90', 'MX-5 Miata'],
  Ford: ['F-150', 'Escape', 'Explorer', 'Edge', 'Fusion', 'Focus', 'Fiesta', 'Mustang', 'Bronco', 'Bronco Sport', 'Ranger', 'Expedition', 'Maverick', 'Mustang Mach-E', 'Transit Connect', 'Flex'],
  Chevrolet: ['Malibu', 'Cruze', 'Equinox', 'Traverse', 'Silverado', 'Spark', 'Trax', 'Tahoe', 'Suburban', 'Colorado', 'Bolt EV', 'Blazer', 'Camaro', 'Sonic', 'Trailblazer'],
  GMC: ['Sierra', 'Terrain', 'Acadia', 'Yukon', 'Canyon', 'Envoy'],
  Dodge: ['Charger', 'Challenger', 'Durango', 'Grand Caravan', 'Journey', 'Dart', 'Avenger'],
  Chrysler: ['Pacifica', '300', 'Voyager'],
  Jeep: ['Wrangler', 'Grand Cherokee', 'Cherokee', 'Compass', 'Renegade', 'Gladiator', 'Patriot'],
  Ram: ['1500', '2500', 'ProMaster', 'ProMaster City'],
  Volkswagen: ['Jetta', 'Golf', 'Passat', 'Tiguan', 'Atlas', 'Taos', 'ID.4', 'Arteon', 'Beetle', 'GTI', 'Polo'],
  Subaru: ['Impreza', 'Crosstrek', 'Forester', 'Outback', 'Legacy', 'WRX', 'Ascent', 'BRZ', 'Solterra'],
  Mitsubishi: ['Outlander', 'RVR', 'Eclipse Cross', 'Mirage', 'Lancer', 'Outlander PHEV'],
  Suzuki: ['Swift', 'SX4', 'Vitara', 'Grand Vitara', 'Kizashi'],
  Lexus: ['RX', 'NX', 'ES', 'IS', 'GX', 'UX', 'LX', 'LS', 'RC'],
  Acura: ['MDX', 'RDX', 'TLX', 'ILX', 'Integra', 'TSX', 'RLX'],
  Infiniti: ['Q50', 'QX50', 'QX60', 'QX80', 'Q60', 'QX30'],
  BMW: ['3 Series', '5 Series', 'X1', 'X3', 'X5', 'X7', '1 Series', '2 Series', '4 Series', '7 Series', 'i4', 'iX', 'X2', 'X4', 'X6'],
  'Mercedes-Benz': ['C-Class', 'E-Class', 'GLC', 'GLE', 'A-Class', 'CLA', 'GLA', 'GLB', 'S-Class', 'Sprinter', 'EQB'],
  Audi: ['A3', 'A4', 'A6', 'Q3', 'Q5', 'Q7', 'A5', 'Q8', 'e-tron'],
  Volvo: ['XC60', 'XC90', 'XC40', 'S60', 'S90', 'V60'],
  Tesla: ['Model 3', 'Model Y', 'Model S', 'Model X'],
  Buick: ['Encore', 'Enclave', 'Envision', 'Regal', 'Verano', 'LaCrosse'],
  Cadillac: ['XT4', 'XT5', 'XT6', 'Escalade', 'CT5', 'CTS', 'ATS', 'Lyriq'],
  Lincoln: ['Corsair', 'Nautilus', 'Aviator', 'Navigator', 'MKZ', 'MKC'],
  Genesis: ['G70', 'G80', 'GV70', 'GV80', 'GV60'],
  'Land Rover': ['Range Rover', 'Range Rover Sport', 'Discovery', 'Defender', 'Evoque'],
  Mini: ['Cooper', 'Countryman', 'Clubman'],
  Porsche: ['Cayenne', 'Macan', 'Taycan', '911'],
  Fiat: ['500', '500X'],
  Jaguar: ['F-Pace', 'XE', 'XF', 'E-Pace'],
};

export type CatalogCar = { make: string; model: string };
const ALL: CatalogCar[] = Object.entries(CATALOG).flatMap(([make, models]) => models.map((model) => ({ make, model })));

/** Cars whose make or model contain every typed word ("toyota rav", "camry", "rav4"). Spaces and dashes are ignored ("rav 4" finds RAV4). */
export function searchCatalog(q: string): CatalogCar[] {
  const norm = (s: string) => s.toLowerCase().replace(/[\s-]/g, '');
  const words = q.toLowerCase().split(/\s+/).filter(Boolean).map(norm);
  if (!words.length) return [];
  return ALL.filter((c) => {
    const text = norm(`${c.make}${c.model}`);
    return words.every((w) => text.includes(w)) || text.includes(norm(q));
  });
}
