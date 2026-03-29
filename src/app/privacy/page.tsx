export default function PrivacyPage() {
  return (
    <main className="dashboard-shell">
      <div className="dashboard-container stack">
        <section className="card stack">
          <small className="dashboard-chip">Legal</small>
          <h1>Privacidad</h1>
          <p>
            DVanguard usa tu correo, datos básicos de perfil y la información que ingresas en onboarding, editor y billing para
            operar la plataforma, generar propuestas visuales, gestionar accesos Pro y darte soporte.
          </p>
          <p>
            Cuando decides pagar, ciertos datos viajan a Wompi para tokenización, validación y procesamiento del medio de pago.
            Si activas recordatorios de vencimiento o compras manuales, podemos enviarte correos transaccionales para avisarte
            sobre renovaciones o expiración del acceso Pro.
          </p>
          <p>
            No vendemos tus datos personales. Conservamos registros operativos mínimos de pagos, membresías y eventos para
            auditoría, soporte y prevención de fraude.
          </p>
        </section>
      </div>
    </main>
  );
}
