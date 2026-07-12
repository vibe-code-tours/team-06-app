import { redirect } from 'next/navigation';

export default function Home() {
  // This page will be handled by middleware
  // Users will be redirected based on their role
  redirect('/login');
}
