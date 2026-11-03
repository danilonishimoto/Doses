import { FormEvent, useEffect, useId, useRef, useState } from 'react';
import {
  AlertIcon,
  CheckCircleIcon,
  PetPawIcon,
  PillIcon,
  PlusIcon,
  ProfilesIcon,
} from '../assets/icons';
import { useDoses } from '../hooks/useDosesData';
import { ProfileType } from '../types';

const PROFILE_TYPE_LABELS: Record<ProfileType, string> = {
  self: 'Uso Próprio',
  family: 'Familiar',
  care: 'Pessoa sob cuidados',
  pet: 'Animal de estimação (Pet)',
};

const AVATAR_PALETTE = ['#00254E', '#4E6D93', '#7BD9B0', '#8DB2D9'];

export function ProfilesPage() {
  const {
    profiles,
    medications,
    activeProfileFilter,
    setActiveProfileFilter,
    addProfile,
  } = useDoses();

  const dialogRef = useRef<HTMLDialogElement>(null);
  const formId = useId();

  const [name, setName] = useState('');
  const [type, setType] = useState<ProfileType>('family');
  const [relationship, setRelationship] = useState('');
  const [speciesOrNotes, setSpeciesOrNotes] = useState('');
  const [allergiesText, setAllergiesText] = useState('');

  useEffect(() => {
    document.title = 'Perfis Acompanhados | Doses';
  }, []);

  const openModal = () => {
    dialogRef.current?.showModal();
  };

  const closeModal = () => {
    dialogRef.current?.close();
  };

  const handleCreateProfile = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const color = AVATAR_PALETTE[profiles.length % AVATAR_PALETTE.length];
    const allergies = allergiesText
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    addProfile({
      name: name.trim(),
      type,
      relationship: relationship.trim() || PROFILE_TYPE_LABELS[type],
      speciesOrNotes: speciesOrNotes.trim() || undefined,
      avatarColor: color,
      allergiesOrAlerts: allergies,
    });

    setName('');
    setRelationship('');
    setSpeciesOrNotes('');
    setAllergiesText('');
    closeModal();
  };

  return (
    <>
      <section aria-labelledby="main-heading">
        <div className="flex-between">
          <div>
            <h1 id="main-heading" tabIndex={-1}>
              Perfis Acompanhados
            </h1>
            <p>
              Organize medicamentos separadamente para você, familiares, pacientes sob cuidados e
              animais de estimação.
            </p>
          </div>
          <button type="button" className="btn btn-primary" onClick={openModal}>
            <PlusIcon size={18} />
            <span>Novo perfil</span>
          </button>
        </div>
      </section>

      <section aria-label="Lista de perfis cadastrados">
        <ul className="cards-grid" role="list">
          {profiles.map((profile) => {
            const profileMeds = medications.filter(
              (m) => m.profileId === profile.id && m.active
            );
            const isSelected = activeProfileFilter === profile.id;

            return (
              <li
                key={profile.id}
                className="card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  borderColor: isSelected ? 'var(--color-blue-dark)' : undefined,
                  borderWidth: isSelected ? '2px' : undefined,
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  <div className="flex-between">
                    <span className="badge badge-neutral">
                      <span
                        className="avatar-dot"
                        style={{ backgroundColor: profile.avatarColor }}
                        aria-hidden="true"
                      />
                      {profile.type === 'pet' ? (
                        <PetPawIcon size={14} />
                      ) : (
                        <ProfilesIcon size={14} />
                      )}
                      <span>{PROFILE_TYPE_LABELS[profile.type]}</span>
                    </span>

                    <span className="badge badge-administered">
                      <PillIcon size={14} />
                      <span>
                        {profileMeds.length}{' '}
                        {profileMeds.length === 1 ? 'medicamento ativo' : 'medicamentos ativos'}
                      </span>
                    </span>
                  </div>

                  <div>
                    <h2 style={{ fontSize: '1.3rem' }}>{profile.name}</h2>
                    <p className="text-primary-strong" style={{ fontSize: '0.9rem' }}>
                      {profile.relationship}
                    </p>
                  </div>

                  {profile.speciesOrNotes && (
                    <p style={{ fontSize: '0.88rem' }}>{profile.speciesOrNotes}</p>
                  )}

                  {profile.allergiesOrAlerts && profile.allergiesOrAlerts.length > 0 ? (
                    <div
                      className="card-subtle"
                      style={{
                        backgroundColor: 'var(--color-status-warning-bg)',
                        borderColor: 'var(--color-status-warning-border)',
                        padding: '0.65rem 0.85rem',
                      }}
                    >
                      <div className="flex-row-gap">
                        <AlertIcon size={15} />
                        <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                          Alergias / Alertas registrados:
                        </span>
                      </div>
                      <p
                        style={{
                          fontSize: '0.82rem',
                          color: 'var(--color-blue-dark)',
                          marginTop: '0.2rem',
                        }}
                      >
                        {profile.allergiesOrAlerts.join(', ')}
                      </p>
                    </div>
                  ) : (
                    <div className="card-subtle" style={{ padding: '0.6rem 0.85rem' }}>
                      <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                        Nenhuma restrição ou alergia medicamentosa informada.
                      </span>
                    </div>
                  )}
                </div>

                <div
                  className="flex-between"
                  style={{
                    borderBlockStart: '1px solid var(--color-border)',
                    paddingBlockStart: '0.85rem',
                  }}
                >
                  <button
                    type="button"
                    className={isSelected ? 'btn btn-success btn-sm' : 'btn btn-secondary btn-sm'}
                    onClick={() =>
                      setActiveProfileFilter(isSelected ? 'all' : profile.id)
                    }
                    aria-pressed={isSelected}
                  >
                    {isSelected ? (
                      <>
                        <CheckCircleIcon size={15} />
                        <span>Filtro ativo no app</span>
                      </>
                    ) : (
                      <span>Filtrar por {profile.name}</span>
                    )}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Modal Nativo (<dialog>) para Cadastro de Perfil */}
      <dialog
        ref={dialogRef}
        className="modal-dialog"
        aria-labelledby={`${formId}-dialog-title`}
      >
        <div className="flex-between">
          <h2 id={`${formId}-dialog-title`}>Adicionar Perfil</h2>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={closeModal}
          >
            Fechar
          </button>
        </div>
        <p className="text-muted" style={{ marginTop: '0.25rem' }}>
          Cadastre uma pessoa ou animal de estimação para separar horários e evitar confusões entre
          medicamentos.
        </p>

        <form className="form-stack" onSubmit={handleCreateProfile}>
          <div className="form-field">
            <label htmlFor={`${formId}-name`} className="form-label">
              Nome completo ou apelido
            </label>
            <input
              id={`${formId}-name`}
              type="text"
              className="form-input"
              autoComplete="name"
              placeholder="Ex.: Dona Maria ou Luna (Gata)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor={`${formId}-type`} className="form-label">
              Categoria do perfil
            </label>
            <select
              id={`${formId}-type`}
              className="form-select"
              value={type}
              onChange={(e) => setType(e.target.value as ProfileType)}
            >
              <option value="self">Uso Próprio</option>
              <option value="family">Familiar (Filho, Idoso, Cônjuge)</option>
              <option value="care">Pessoa sob cuidados profissionais</option>
              <option value="pet">Animal de estimação (Pet)</option>
            </select>
          </div>

          <div className="form-field">
            <label htmlFor={`${formId}-rel`} className="form-label">
              Identificação ou vínculo
            </label>
            <input
              id={`${formId}-rel`}
              type="text"
              className="form-input"
              placeholder="Ex.: Mãe • 72 anos ou Cão SRD • 12 kg"
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
            />
          </div>

          <div className="form-field">
            <label htmlFor={`${formId}-allergies`} className="form-label">
              Alergias ou alertas importantes (opcional)
            </label>
            <span id={`${formId}-allergies-hint`} className="form-hint">
              Separe por vírgula caso exista mais de uma restrição conhecida.
            </span>
            <input
              id={`${formId}-allergies`}
              type="text"
              className="form-input"
              aria-describedby={`${formId}-allergies-hint`}
              placeholder="Ex.: Dipirona, Ácido Acetilsalicílico"
              value={allergiesText}
              onChange={(e) => setAllergiesText(e.target.value)}
            />
          </div>

          <div className="form-field">
            <label htmlFor={`${formId}-notes`} className="form-label">
              Observações de rotina (opcional)
            </label>
            <textarea
              id={`${formId}-notes`}
              className="form-textarea"
              rows={2}
              placeholder="Ex.: Prefere tomar comprimidos com água em temperatura ambiente."
              value={speciesOrNotes}
              onChange={(e) => setSpeciesOrNotes(e.target.value)}
            />
          </div>

          <div className="flex-between" style={{ marginTop: '0.5rem' }}>
            <button type="button" className="btn btn-secondary" onClick={closeModal}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary">
              Salvar perfil
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
