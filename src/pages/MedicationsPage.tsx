import { FormEvent, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  CheckCircleIcon,
  ClockIcon,
  PetPawIcon,
  PillIcon,
  PlusIcon,
} from '../assets/icons';
import { useDoses } from '../hooks/useDosesData';
import { MedicationForm } from '../types';
import { formatReadableDate, getTodayISO } from '../utils/dateUtils';

const MEDICATION_FORMS: MedicationForm[] = [
  'Comprimido',
  'Cápsula',
  'Gotas',
  'Xarope',
  'Injetável',
  'Pomada',
  'Spray',
  'Outro',
];

export function MedicationsPage() {
  const {
    profiles,
    medications,
    activeProfileFilter,
    addMedication,
    toggleMedicationActive,
  } = useDoses();

  const dialogRef = useRef<HTMLDialogElement>(null);
  const formId = useId();
  const [searchQuery, setSearchQuery] = useState('');

  // Estado do formulário de novo medicamento
  const [profileId, setProfileId] = useState(profiles[0]?.id || '');
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [form, setForm] = useState<MedicationForm>('Comprimido');
  const [frequencyLabel, setFrequencyLabel] = useState('A cada 12 horas (2x ao dia)');
  const [timesText, setTimesText] = useState('08:00, 20:00');
  const [instructions, setInstructions] = useState('');
  const [continuousUse, setContinuousUse] = useState(true);
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    document.title = 'Medicamentos | Doses';
  }, []);

  const visibleMedications = useMemo(() => {
    return medications
      .filter((med) =>
        activeProfileFilter === 'all' ? true : med.profileId === activeProfileFilter
      )
      .filter((med) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          med.name.toLowerCase().includes(q) ||
          med.dosage.toLowerCase().includes(q) ||
          med.instructions.toLowerCase().includes(q)
        );
      });
  }, [medications, activeProfileFilter, searchQuery]);

  const openModal = () => {
    if (activeProfileFilter !== 'all') {
      setProfileId(activeProfileFilter);
    } else if (profiles[0]) {
      setProfileId(profiles[0].id);
    }
    dialogRef.current?.showModal();
  };

  const closeModal = () => {
    dialogRef.current?.close();
  };

  const handleCreateMedication = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !dosage.trim() || !profileId) return;

    const parsedTimes = timesText
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    addMedication({
      profileId,
      name: name.trim(),
      dosage: dosage.trim(),
      form,
      frequencyLabel: frequencyLabel.trim(),
      times: parsedTimes.length > 0 ? parsedTimes : ['08:00'],
      instructions:
        instructions.trim() || 'Seguir estritamente a orientação da receita médica/veterinária.',
      startDate: getTodayISO(),
      endDate: continuousUse ? undefined : endDate || undefined,
      continuousUse,
      active: true,
    });

    setName('');
    setDosage('');
    setInstructions('');
    closeModal();
  };

  return (
    <>
      <section aria-labelledby="main-heading">
        <div className="flex-between">
          <div>
            <h1 id="main-heading" tabIndex={-1}>
              Medicamentos Cadastrados
            </h1>
            <p>
              Consulte apresentações, dosagens, horários e instruções de administração de cada
              tratamento.
            </p>
          </div>
          <button type="button" className="btn btn-primary" onClick={openModal}>
            <PlusIcon size={18} />
            <span>Adicionar medicamento</span>
          </button>
        </div>
      </section>

      {/* Barra de Busca Rápida */}
      <section aria-label="Filtrar medicamentos por nome ou dosagem" className="card-subtle">
        <div className="form-field">
          <label htmlFor={`${formId}-search`} className="form-label">
            Buscar medicamento na lista
          </label>
          <input
            id={`${formId}-search`}
            type="search"
            className="form-input"
            placeholder="Ex.: Losartana, 50 mg, jejum..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </section>

      {/* Lista de Medicamentos */}
      <section aria-label="Listagem de medicamentos">
        {visibleMedications.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: '2.5rem 1.25rem' }}>
            <h2>Nenhum medicamento encontrado</h2>
            <p style={{ marginInline: 'auto', marginTop: '0.4rem' }}>
              Não há medicamentos correspondentes ao filtro atual. Você pode adicionar um novo
              medicamento ou alternar o perfil selecionado.
            </p>
          </div>
        ) : (
          <ul className="cards-grid" role="list">
            {visibleMedications.map((med) => {
              const profile = profiles.find((p) => p.id === med.profileId);

              return (
                <li key={med.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                    <div className="flex-between">
                      {profile && (
                        <span className="badge badge-neutral">
                          <span
                            className="avatar-dot"
                            style={{ backgroundColor: profile.avatarColor }}
                            aria-hidden="true"
                          />
                          {profile.type === 'pet' && <PetPawIcon size={14} />}
                          <span>{profile.name}</span>
                        </span>
                      )}

                      <span className={med.active ? 'badge badge-administered' : 'badge badge-neutral'}>
                        {med.active ? (
                          <>
                            <CheckCircleIcon size={14} />
                            <span>Em uso ativo</span>
                          </>
                        ) : (
                          <span>Pausado</span>
                        )}
                      </span>
                    </div>

                    <div>
                      <h2 style={{ fontSize: '1.22rem' }}>{med.name}</h2>
                      <p className="text-primary-strong" style={{ fontSize: '0.92rem' }}>
                        {med.dosage} • {med.form}
                      </p>
                    </div>

                    <p style={{ fontSize: '0.88rem' }}>{med.instructions}</p>

                    <div className="card-subtle" style={{ padding: '0.75rem 0.9rem' }}>
                      <div className="flex-row-gap" style={{ marginBottom: '0.4rem' }}>
                        <ClockIcon size={15} />
                        <span style={{ fontSize: '0.82rem', fontWeight: 700 }}>
                          {med.frequencyLabel}
                        </span>
                      </div>
                      <div className="flex-row-gap">
                        {med.times.map((t) => (
                          <span key={t} className="badge badge-neutral">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="text-muted" style={{ fontSize: '0.8rem' }}>
                      <span>Início: {formatReadableDate(med.startDate)}</span>
                      {' • '}
                      <span>
                        Término: {med.continuousUse ? 'Uso contínuo' : formatReadableDate(med.endDate)}
                      </span>
                    </div>
                  </div>

                  <div className="flex-between" style={{ borderBlockStart: '1px solid var(--color-border)', paddingBlockStart: '0.85rem' }}>
                    <span className="text-muted" style={{ fontSize: '0.78rem' }}>
                      <PillIcon size={14} /> Prescrição vinculada
                    </span>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => toggleMedicationActive(med.id)}
                      aria-label={`${med.active ? 'Pausar' : 'Reativar'} acompanhamento de ${med.name}`}
                    >
                      {med.active ? 'Pausar uso' : 'Reativar uso'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Modal Nativo (<dialog>) para Cadastro de Medicamento */}
      <dialog
        ref={dialogRef}
        className="modal-dialog"
        aria-labelledby={`${formId}-dialog-title`}
      >
        <div className="flex-between">
          <h2 id={`${formId}-dialog-title`}>Cadastrar Medicamento</h2>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={closeModal}
          >
            Fechar
          </button>
        </div>
        <p className="text-muted" style={{ marginTop: '0.25rem' }}>
          Transcreva os dados exatamente como constam na receita médica ou veterinária.
        </p>

        <form className="form-stack" onSubmit={handleCreateMedication}>
          <div className="form-field">
            <label htmlFor={`${formId}-profile`} className="form-label">
              Perfil destinatário
            </label>
            <select
              id={`${formId}-profile`}
              className="form-select"
              value={profileId}
              onChange={(e) => setProfileId(e.target.value)}
              required
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.relationship})
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor={`${formId}-name`} className="form-label">
              Nome do medicamento
            </label>
            <input
              id={`${formId}-name`}
              type="text"
              className="form-input"
              placeholder="Ex.: Dipirona Monoidratada"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="stats-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="form-field">
              <label htmlFor={`${formId}-dosage`} className="form-label">
                Dosagem prescrita
              </label>
              <input
                id={`${formId}-dosage`}
                type="text"
                className="form-input"
                placeholder="Ex.: 500 mg ou 20 gotas"
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor={`${formId}-form`} className="form-label">
                Apresentação
              </label>
              <select
                id={`${formId}-form`}
                className="form-select"
                value={form}
                onChange={(e) => setForm(e.target.value as MedicationForm)}
              >
                {MEDICATION_FORMS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-field">
            <label htmlFor={`${formId}-freq`} className="form-label">
              Frequência de administração
            </label>
            <input
              id={`${formId}-freq`}
              type="text"
              className="form-input"
              value={frequencyLabel}
              onChange={(e) => setFrequencyLabel(e.target.value)}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor={`${formId}-times`} className="form-label">
              Horários programados
            </label>
            <span id={`${formId}-times-hint`} className="form-hint">
              Informe os horários no formato HH:mm separados por vírgula (ex.: 08:00, 20:00).
            </span>
            <input
              id={`${formId}-times`}
              type="text"
              className="form-input"
              aria-describedby={`${formId}-times-hint`}
              value={timesText}
              onChange={(e) => setTimesText(e.target.value)}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor={`${formId}-instructions`} className="form-label">
              Instruções de uso e cuidados
            </label>
            <textarea
              id={`${formId}-instructions`}
              className="form-textarea"
              rows={2}
              placeholder="Ex.: Tomar após o almoço com um copo cheio de água."
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
          </div>

          <div className="form-field">
            <label className="flex-row-gap" style={{ cursor: 'pointer', fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={continuousUse}
                onChange={(e) => setContinuousUse(e.target.checked)}
                style={{ width: '1.15rem', height: '1.15rem' }}
              />
              <span>Tratamento de uso contínuo (sem data de término definida)</span>
            </label>
          </div>

          {!continuousUse && (
            <div className="form-field">
              <label htmlFor={`${formId}-enddate`} className="form-label">
                Data de término do tratamento
              </label>
              <input
                id={`${formId}-enddate`}
                type="date"
                className="form-input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          )}

          <div className="flex-between" style={{ marginTop: '0.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={closeModal}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              Salvar medicamento
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
