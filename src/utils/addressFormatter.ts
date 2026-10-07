export interface FormattedAddress {
  cleanAddress: string;
  doorNo?: string;
  street?: string;
  building?: string;
  floor?: string;
  area?: string;
  landmark?: string;
  city?: string;
  pincode?: string;
  contactInfo?: string;
  addressType?: string;
  hubId?: string;
  gpsCoords?: string;
}

export function formatAddressDetails(rawAddress?: string): FormattedAddress {
  if (!rawAddress || rawAddress.trim().length === 0) {
    return { cleanAddress: 'No address provided' };
  }

  let text = rawAddress.trim();

  // 1. Extract GPS if present
  let gpsCoords: string | undefined;
  const gpsMatch = text.match(/\[GPS:\s*\(([^)]+)\)\]/i);
  if (gpsMatch) {
    gpsCoords = gpsMatch[1].trim();
    text = text.replace(/\[GPS:\s*\(([^)]+)\)\]/i, '');
  }

  // 2. Extract Contact if present
  let contactInfo: string | undefined;
  const contactMatch = text.match(/\|\s*Contact:\s*([^|]+)/i);
  if (contactMatch) {
    contactInfo = contactMatch[1].trim();
    text = text.replace(/\|\s*Contact:\s*([^|]+)/i, '');
  }

  // 3. Extract Type if present
  let addressType: string | undefined;
  const typeMatch = text.match(/\|\s*Type:\s*([^|]+)/i);
  if (typeMatch) {
    addressType = typeMatch[1].trim();
    text = text.replace(/\|\s*Type:\s*([^|]+)/i, '');
  }

  // 4. Extract Hub if present
  let hubId: string | undefined;
  const hubMatch = text.match(/\|\s*Hub:\s*([^|]+)/i);
  if (hubMatch) {
    hubId = hubMatch[1].trim();
    text = text.replace(/\|\s*Hub:\s*([^|]+)/i, '');
  }

  // 5. Parse key-value tokens from main address string
  let doorNo: string | undefined;
  let street: string | undefined;
  let building: string | undefined;
  let floor: string | undefined;
  let area: string | undefined;
  let landmark: string | undefined;
  let city: string | undefined;
  let pincode: string | undefined;

  const doorM = text.match(/(?:Door No|House No|Flat No|Door|House):\s*([^,]+)/i);
  if (doorM) doorNo = doorM[1].trim();

  const streetM = text.match(/(?:Street|Road):\s*([^,]+)/i);
  if (streetM) street = streetM[1].trim();

  const buildingM = text.match(/(?:Building|Apartment):\s*([^,]+)/i);
  if (buildingM) building = buildingM[1].trim();

  const floorM = text.match(/Floor:\s*([^,]+)/i);
  if (floorM) floor = floorM[1].trim();

  const areaM = text.match(/(?:Area|Locality):\s*([^,]+)/i);
  if (areaM) area = areaM[1].trim();

  const landmarkM = text.match(/Landmark:\s*([^,]+)/i);
  if (landmarkM) landmark = landmarkM[1].trim();

  const cityM = text.match(/City:\s*([^,]+(?:,\s*[^,]+)?)/i);
  if (cityM) {
    city = cityM[1].replace(/PIN:.*/i, '').trim();
  }

  const pinM = text.match(/(?:PIN|Pincode|Postal):\s*(\d{5,6})/i) || text.match(/\b\d{6}\b/);
  if (pinM) pincode = pinM[1] || pinM[0];

  // Fallback splitting if key-value tags are not present
  if (!doorNo && !street && !area && !city) {
    const parts = text.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length === 1) {
      area = parts[0];
    } else if (parts.length === 2) {
      street = parts[0];
      area = parts[1];
    } else if (parts.length === 3) {
      doorNo = parts[0];
      street = parts[1];
      area = parts[2];
    } else if (parts.length >= 4) {
      doorNo = parts[0];
      street = parts[1];
      area = parts[2];
      city = parts[3];
      if (parts[4] && /^\d{6}$/.test(parts[4])) {
        pincode = parts[4];
      }
    }
  }

  // Clean remaining separators and spaces
  let cleanAddress = text
    .replace(/\s*\|\s*/g, ', ')
    .replace(/,\s*,/g, ',')
    .replace(/^\s*,\s*/, '')
    .replace(/\s*,\s*$/, '')
    .trim();

  if (!cleanAddress || cleanAddress.length < 3) {
    cleanAddress = 'Address on file';
  }

  return {
    cleanAddress,
    doorNo,
    street,
    building,
    floor,
    area,
    landmark,
    city,
    pincode,
    contactInfo,
    addressType,
    hubId,
    gpsCoords,
  };
}

export function getGoogleMapsUrl(formatted: FormattedAddress): string {
  if (formatted.gpsCoords && formatted.gpsCoords.trim()) {
    const cleanCoords = formatted.gpsCoords.replace(/\s+/g, '');
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cleanCoords)}`;
  }
  
  const parts = [
    formatted.doorNo ? `Door ${formatted.doorNo}` : '',
    formatted.building,
    formatted.street,
    formatted.area,
    formatted.landmark ? `Near ${formatted.landmark}` : '',
    formatted.city || 'Hosur',
    formatted.pincode
  ].filter(Boolean);

  const queryStr = parts.length > 0 ? parts.join(', ') : formatted.cleanAddress;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(queryStr)}`;
}
