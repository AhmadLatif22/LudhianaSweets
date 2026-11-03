export const validUUID = v => typeof v === 'string' && /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(v);
export function cleanCustomer(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Enter valid delivery information');
  const val = (key,max=120) => typeof raw[key] === 'string' ? raw[key].trim().slice(0,max) : '';
  const customer = {
    firstName:val('firstName',60),lastName:val('lastName',60),fullName:val('fullName',120),
    email:val('email',160).toLowerCase(),phone:val('phone',25),address:val('address',250),
    city:val('city',90),country:'Pakistan',postalCode:val('postalCode',15),notes:val('notes',500)
  };
  customer.fullName = `${customer.firstName} ${customer.lastName}`.trim();
  if (!customer.firstName || !customer.lastName || !/^\S+@\S+\.\S+$/.test(customer.email)
      || !/^(?:\+?92|0)3\d{9}$/.test(customer.phone.replace(/[\s-]/g,''))
      || customer.address.length < 6 || customer.city.length < 2) throw new Error('Check name, email, Pakistan mobile number, city and delivery address');
  const digits=customer.phone.replace(/\D/g,'');
  customer.phone=digits.startsWith('03')?`92${digits.slice(1)}`:digits;
  return customer;
}
export function cleanItems(items) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 30) throw new Error('Cart must contain 1–30 products');
  const merged = new Map();
  for (const x of items) {
    if (!x || typeof x.productId !== 'string' || typeof x.weight !== 'string' || !Number.isInteger(x.quantity) || x.quantity < 1 || x.quantity > 20 || x.productId.length > 100 || x.weight.length > 40) throw new Error('Invalid cart item');
    const key = JSON.stringify([x.productId,x.weight]);
    const existing = merged.get(key);
    const quantity = x.quantity + (existing?.quantity || 0);
    if (quantity > 20) throw new Error('Too many units of one product');
    merged.set(key,{productId:x.productId,weight:x.weight,quantity});
  }
  return [...merged.values()];
}

