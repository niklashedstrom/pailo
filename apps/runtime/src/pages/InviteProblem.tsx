interface Props {
  onContinue: () => void
}

export default function InviteProblem({ onContinue }: Props) {
  return (
    <>
      <h1>Länken fungerar inte längre</h1>
      <p>
        Inbjudningslänkar gäller i 3 dagar och kan bara användas en gång. Be den som bjöd in dig att skicka en ny
        länk.
      </p>
      <button type="button" onClick={onContinue}>
        Fortsätt till Pailo
      </button>
    </>
  )
}
