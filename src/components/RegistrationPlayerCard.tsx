import { Check, Utensils } from 'lucide-react';
import { CollegePicker } from './CollegePicker';
import { MAX_ACADEMIC_LEVEL_LENGTH, MAX_COLLEGE_NAME_LENGTH, OTHER_ACADEMIC_LEVEL, type PlayerInput } from '../lib/tournamentRules';

const playerFields = [
  { key: 'fullName', label: 'Full name', id: 'fullName' },
  { key: 'inGameName', label: 'In-game name (IGN)', id: 'ign' },
  { key: 'characterId', label: 'Character ID', id: 'cid' },
] as const;

interface RegistrationPlayerCardProps {
  member: PlayerInput;
  label: string;
  complete: boolean;
  errors: Record<string, string>;
  /** Team leader's college, offered as a one-click fill for teammates. */
  leaderCollege?: string;
  onChange: (patch: Partial<PlayerInput>) => void;
}

export function RegistrationPlayerCard({ member, label, complete, errors, leaderCollege = '', onChange }: RegistrationPlayerCardProps) {
  const leader = member.slotRole === 'IGL';
  const prefix = `member_${member.slotRole}`;
  const levelError = errors[`${prefix}_academicLevel`];
  const otherLevelError = errors[`${prefix}_otherAcademicLevel`];
  const dietError = errors[`${prefix}_dietType`];
  const collegeError = errors[`${prefix}_collegeOverride`];
  const collegeId = `${prefix}-college`;
  const college = member.collegeOverride ?? '';
  const offerLeaderCollege = !leader && leaderCollege.trim() !== '' && college.trim() !== leaderCollege.trim();

  return (
    <section className={`registration-player ${leader ? 'registration-player-leader' : ''}`} aria-labelledby={`${prefix}-title`}>
      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
        <h3 id={`${prefix}-title`} className="font-display text-xl font-bold">{label}</h3>
        {complete && <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-300"><Check className="size-4" aria-hidden="true" /> Ready</span>}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {playerFields.map(({ key, label, id }) => {
          const fieldId = `${prefix}-${id}`;
          const error = errors[`${prefix}_${key}`];
          const leaderName = leader && key === 'fullName';
          return (
            <div key={key}>
              <label htmlFor={fieldId} className={`registration-label ${leaderName ? 'text-[#F5D985]' : ''}`}>
                {leaderName ? 'Team leader’s full name' : label} *
              </label>
              <input
                id={fieldId}
                type="text"
                value={member[key] ?? ''}
                onChange={(e) => onChange({ [key]: e.target.value })}
                aria-required="true"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? `${fieldId}-error` : undefined}
                className={`registration-input ${leaderName ? 'registration-leader-input' : ''}`}
              />
              {error && <p id={`${fieldId}-error`} className="registration-error">{error}</p>}
            </div>
          );
        })}
        <div className="sm:col-span-2">
          <label htmlFor={collegeId} className="registration-label">College / institution name *</label>
          <CollegePicker
            id={collegeId}
            value={college}
            onChange={(value) => onChange({ collegeOverride: value })}
            maxLength={MAX_COLLEGE_NAME_LENGTH}
            invalid={Boolean(collegeError)}
            errorId={`${collegeId}-error`}
            inputClassName="registration-input"
          />
          {offerLeaderCollege && (
            <button type="button" className="college-picker-same" onClick={() => onChange({ collegeOverride: leaderCollege })}>
              Same as team leader: {leaderCollege}
            </button>
          )}
          {collegeError && <p id={`${collegeId}-error`} className="registration-error">{collegeError}</p>}
        </div>
        <div>
          <label htmlFor={`${prefix}-level`} className="registration-label">Academic level *</label>
          <select
            id={`${prefix}-level`}
            value={member.academicLevel}
            onChange={(e) => onChange({ academicLevel: e.target.value, otherAcademicLevel: '' })}
            aria-required="true"
            aria-invalid={Boolean(levelError)}
            aria-describedby={levelError ? `${prefix}-level-error` : undefined}
            className="registration-input"
          >
            <option value="" disabled>Select academic level</option>
            <option value="11th">11th Class</option>
            <option value="12th">12th Class</option>
            <option value="UG">Undergraduate (UG)</option>
            <option value={OTHER_ACADEMIC_LEVEL}>Others</option>
          </select>
          {levelError && <p id={`${prefix}-level-error`} className="registration-error">{levelError}</p>}
        </div>
        {member.academicLevel === OTHER_ACADEMIC_LEVEL && (
          <div>
            <label htmlFor={`${prefix}-other-level`} className="registration-label">Course / academic level *</label>
            <input
              id={`${prefix}-other-level`}
              type="text"
              placeholder="e.g. MBA, MCA"
              value={member.otherAcademicLevel ?? ''}
              maxLength={MAX_ACADEMIC_LEVEL_LENGTH}
              onChange={(e) => onChange({ otherAcademicLevel: e.target.value })}
              aria-required="true"
              aria-invalid={Boolean(otherLevelError)}
              aria-describedby={otherLevelError ? `${prefix}-other-level-error` : undefined}
              className="registration-input"
            />
            {otherLevelError && <p id={`${prefix}-other-level-error`} className="registration-error">{otherLevelError}</p>}
          </div>
        )}
      </div>

      <div className="registration-meal">
        <label className="inline-flex min-h-10 min-w-0 cursor-pointer items-center gap-2 text-sm text-neutral-200">
          <input
            type="checkbox"
            checked={member.wantsLunch}
            onChange={(e) => onChange({ wantsLunch: e.target.checked })}
            className="size-4 shrink-0 accent-[#D41B14]"
          />
          <Utensils className="size-4 shrink-0 text-neutral-400" aria-hidden="true" />
          Add optional lunch
        </label>
        {member.wantsLunch && (
          <fieldset className="flex flex-wrap gap-2">
            <legend className="sr-only">Meal preference</legend>
            {(['VEG', 'NON_VEG'] as const).map((diet) => (
              <label key={diet} className="registration-meal-choice">
                <input
                  type="radio"
                  name={`${prefix}-diet`}
                  checked={member.dietType === diet}
                  onChange={() => onChange({ dietType: diet })}
                />
                <span>{diet === 'VEG' ? 'Veg' : 'Non-veg'}</span>
              </label>
            ))}
            {dietError && <p className="registration-error">{dietError}</p>}
          </fieldset>
        )}
      </div>
    </section>
  );
}
