import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Search } from 'lucide-react';
import { searchColleges, type CollegeOption } from '../lib/odishaColleges';

interface CollegePickerProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  invalid?: boolean;
  errorId?: string;
  placeholder?: string;
  inputClassName: string;
}

/**
 * Text box with Odisha college suggestions. Students pick from the list or keep typing
 * their own college name if it is not listed: whatever is in the box is what gets saved.
 */
export function CollegePicker({
  id,
  value,
  onChange,
  maxLength,
  invalid,
  errorId,
  placeholder = 'Search your college, e.g. KIIT, Ravenshaw, BJB',
  inputClassName,
}: CollegePickerProps) {
  const listId = useId();
  const hintId = `${id}-hint`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const results = useMemo(() => searchColleges(value), [value]);
  const exactMatch = results.some((option) => option.value.trim().toLowerCase() === value.trim().toLowerCase());
  const showList = open && (results.length > 0 || value.trim().length > 0) && !exactMatch;

  function choose(option: CollegeOption) {
    onChange(option.value.slice(0, maxLength));
    setOpen(false);
    setActive(-1);
    if (option.needsBranch) {
      // Leave the cursor after "Name, " so the student can add their branch or city.
      requestAnimationFrame(() => {
        const input = inputRef.current;
        if (input) input.setSelectionRange(input.value.length, input.value.length);
      });
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, -1));
    } else if (event.key === 'Enter' && showList && active >= 0 && results[active]) {
      event.preventDefault();
      choose(results[active]);
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      setOpen(false);
      setActive(-1);
    }
  }

  const describedBy = [hintId, invalid && errorId ? errorId : ''].filter(Boolean).join(' ');

  return (
    <div className="college-picker">
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
          aria-required="true"
          aria-invalid={Boolean(invalid)}
          aria-describedby={describedBy}
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          className={`${inputClassName} college-picker-input`}
        />
        <Search className="college-picker-icon" aria-hidden="true" />

        {showList && (
          <ul id={listId} role="listbox" aria-label="Matching colleges" className="college-picker-list">
            {results.map((option, index) => (
              <li
                key={`${option.name}-${option.city}-${option.category}`}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                className="college-picker-option"
                // mousedown fires before the input's blur, so the click is not lost.
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(option);
                }}
                onMouseEnter={() => setActive(index)}
              >
                <span className="college-picker-name">{option.name}</span>
                <span className="college-picker-meta">
                  {option.needsBranch ? 'Add your branch / city after picking' : option.city}
                  {' · '}
                  {option.category}
                </span>
              </li>
            ))}
            {value.trim().length > 0 && (
              <li
                role="option"
                aria-selected={false}
                className="college-picker-manual"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setOpen(false);
                }}
              >
                {results.length === 0 ? 'No match found. ' : 'Not in the list? '}
                Keep <strong>“{value.trim()}”</strong> as typed
              </li>
            )}
          </ul>
        )}
      </div>
      <p id={hintId} className="college-picker-hint">
        Search by name, short form or city. Not listed? Type the full name.
      </p>
    </div>
  );
}
