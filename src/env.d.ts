/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    sid: string | null;
    user: import('./lib/session').User | null;
    company: import('./lib/session').Company | null;
  }
}
