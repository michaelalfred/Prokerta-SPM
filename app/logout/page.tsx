import { logout } from './actions';

export default function LogoutPage() {
  return <main className="mx-auto max-w-md p-6"><form action={logout}><button className="rounded border px-4 py-2">Keluar</button></form></main>;
}
