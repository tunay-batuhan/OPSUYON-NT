import { redirect } from "next/navigation";

/** Savunmalar ve İhtarlar artık üst menüde ayrı sekme. */
export default function DefensesMovedPage() {
  redirect("/savunmalar");
}
