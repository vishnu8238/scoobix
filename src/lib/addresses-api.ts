import { listTable, createRecord, patchRecord, deleteRecord } from "./insforge-crud";

export type Address = {
  id: string;
  user_id: string;
  label: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  is_default: boolean;
};

export async function fetchAddresses(userId: string): Promise<Address[]> {
  return listTable<Address>("addresses", { user_id: `eq.${userId}`, order: "is_default.desc,id.asc" }, { fresh: true, ttl: 0 });
}

export async function saveAddress(address: Partial<Address> & { user_id: string }): Promise<Address | null> {
  if (address.id) {
    return patchRecord<Address>("addresses", address.id, address);
  }
  
  // If this is the first address, make it default
  const existing = await fetchAddresses(address.user_id);
  if (existing.length === 0) {
    address.is_default = true;
  }
  
  return createRecord<Address>("addresses", address as any);
}

export async function setDefaultAddress(addressId: string, userId: string): Promise<void> {
  const existing = await fetchAddresses(userId);
  await Promise.all(
    existing.map(a => 
      patchRecord("addresses", a.id, { is_default: a.id === addressId })
    )
  );
}

export async function removeAddress(addressId: string): Promise<void> {
  await deleteRecord("addresses", addressId);
}
