import { Check } from "lucide-react";

const steps = ["Route", "Seat", "Confirmation"];

export function BookingProgress({ currentStep }) {
  return <ol className="booking-progress" aria-label="Booking steps">
    {steps.map((label, index) => {
      const step = index + 1;
      const current = currentStep === step;
      const complete = currentStep > step;
      return <li key={label} aria-current={current ? "step" : undefined} className={current ? "is-current" : complete ? "is-complete" : ""}>
        <span className="booking-progress__marker">{complete ? <Check size={15} /> : step}</span>
        <span className="booking-progress__label">{label}</span>
        {index < steps.length - 1 && <span className="booking-progress__line" aria-hidden="true" />}
      </li>;
    })}
  </ol>;
}