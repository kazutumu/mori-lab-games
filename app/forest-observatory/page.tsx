import type { Metadata } from 'next';
import Forest from './Forest';
export const metadata: Metadata = { title: '木漏れ日の観測林 | 森研究所', robots: { index: false, follow: false } };
export default function Page() { return <Forest />; }
