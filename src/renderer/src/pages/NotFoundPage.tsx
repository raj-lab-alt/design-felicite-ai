import { useNavigate } from 'react-router-dom'
import { Button, EmptyState } from '../components/ui/primitives'

export function NotFoundPage(): React.JSX.Element {
  const navigate = useNavigate()
  return (
    <div className="mx-auto max-w-xl px-6 py-16">
      <EmptyState
        title="Page introuvable"
        description="Cette page n’existe pas ou le lien est invalide."
        action={<Button onClick={() => navigate('/')}>Retour à l’accueil</Button>}
      />
    </div>
  )
}