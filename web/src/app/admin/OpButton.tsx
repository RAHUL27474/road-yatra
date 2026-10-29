import { updateBooking } from "./actions";

/**
 * One booking action ("cash", "upi", "complete", …) as its own tiny form with the action in a hidden field.
 * Several buttons sharing one form and telling the action apart by the clicked button's value lost that value
 * (React's form action did not receive the submitter), so the server did nothing.
 */
export default function OpButton({ id, back, op, className, title, children }: { id: string; back: string; op: string; className: string; title?: string; children: React.ReactNode }) {
  return (
    <form action={updateBooking} className="inline">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="back" value={back} />
      <input type="hidden" name="op" value={op} />
      <button className={className} title={title}>
        {children}
      </button>
    </form>
  );
}
