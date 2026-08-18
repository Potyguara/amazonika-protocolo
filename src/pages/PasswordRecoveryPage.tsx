import {
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  Mail,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

import type {
  FormEvent,
} from "react";

import {
  Link,
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import { api } from "../services/api";

import "./PasswordRecoveryPage.css";

export function ForgotPasswordPage() {
  const [email, setEmail] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  async function submit(
    event: FormEvent
  ) {
    event.preventDefault();

    const normalized =
      email.trim().toLowerCase();

    if (!normalized) {
      setError(
        "Informe o e-mail cadastrado."
      );
      return;
    }

    try {
      setLoading(true);
      setError("");
      setSuccess("");

      const response =
        await api.forgotPassword(
          normalized
        ) as {
          message?: string;
        };

      setSuccess(
        response?.message ||
        "Se o e-mail estiver cadastrado, enviaremos as instruções."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível solicitar a redefinição."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="password-recovery-page">
      <div className="password-recovery-overlay" />

      <section className="password-recovery-card">
        <div className="password-recovery-brand">
          <img
            src="/brand/logo-amazonika.png"
            alt="SIS Amazonika"
          />
        </div>

        <div className="password-recovery-icon">
          <Mail size={25} />
        </div>

        <span className="password-recovery-eyebrow">
          SEGURANÇA DA CONTA
        </span>

        <h1>Esqueci minha senha</h1>

        <p>
          Informe o e-mail cadastrado no
          SIS Amazonika. Se houver uma conta
          ativa, enviaremos um link seguro
          para redefinir sua senha.
        </p>

        {error && (
          <div className="password-recovery-message error">
            {error}
          </div>
        )}

        {success ? (
          <div className="password-recovery-success">
            <CheckCircle2 size={35} />

            <strong>
              Verifique seu e-mail
            </strong>

            <p>
              {success}
            </p>

            <Link
              to="/login"
              className="password-recovery-primary"
            >
              Voltar para o login
            </Link>
          </div>
        ) : (
          <form onSubmit={submit}>
            <label>
              E-mail
              <div className="password-recovery-input">
                <Mail size={18} />

                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(
                      event.target.value
                    )
                  }
                  placeholder="seuemail@dominio.com.br"
                />
              </div>
            </label>

            <button
              type="submit"
              className="password-recovery-primary"
              disabled={loading}
            >
              {loading
                ? "Enviando..."
                : "Enviar link de recuperação"}
            </button>

            <Link
              to="/login"
              className="password-recovery-back"
            >
              Voltar para o login
            </Link>
          </form>
        )}
      </section>
    </main>
  );
}

export function ResetPasswordPage() {
  const [searchParams] =
    useSearchParams();

  const navigate =
    useNavigate();

  const token =
    searchParams.get("token") || "";

  const [validating, setValidating] =
    useState(true);

  const [valid, setValid] =
    useState(false);

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [confirmation, setConfirmation] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [
    showConfirmation,
    setShowConfirmation,
  ] = useState(false);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  useEffect(() => {
    async function validate() {
      if (!token) {
        setError(
          "Link de redefinição inválido."
        );
        setValidating(false);
        return;
      }

      try {
        const response =
          await api
            .validatePasswordResetToken(
              token
            ) as {
              valid?: boolean;
              email?: string;
            };

        setValid(
          Boolean(response.valid)
        );

        setEmail(
          response.email || ""
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Este link não é válido."
        );
      } finally {
        setValidating(false);
      }
    }

    validate();
  }, [token]);

  async function submit(
    event: FormEvent
  ) {
    event.preventDefault();

    setError("");

    if (
      password.length < 8
    ) {
      setError(
        "A senha deve possuir pelo menos 8 caracteres."
      );
      return;
    }

    if (
      password !==
      confirmation
    ) {
      setError(
        "A confirmação não corresponde à nova senha."
      );
      return;
    }

    try {
      setSaving(true);

      const response =
        await api.resetPassword(
          token,
          password
        ) as {
          message?: string;
        };

      setSuccess(
        response.message ||
        "Senha redefinida com sucesso."
      );

      setTimeout(() => {
        navigate(
          "/login",
          {
            replace: true,
          }
        );
      }, 2200);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível redefinir a senha."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="password-recovery-page">
      <div className="password-recovery-overlay" />

      <section className="password-recovery-card">
        <div className="password-recovery-brand">
          <img
            src="/brand/logo-amazonika.png"
            alt="SIS Amazonika"
          />
        </div>

        <div className="password-recovery-icon">
          <KeyRound size={25} />
        </div>

        <span className="password-recovery-eyebrow">
          SEGURANÇA DA CONTA
        </span>

        <h1>Redefinir senha</h1>

        {validating ? (
          <p>
            Validando seu link seguro...
          </p>
        ) : success ? (
          <div className="password-recovery-success">
            <CheckCircle2 size={35} />

            <strong>
              Senha alterada
            </strong>

            <p>{success}</p>

            <span>
              Redirecionando para o login...
            </span>
          </div>
        ) : !valid ? (
          <>
            <div className="password-recovery-message error">
              {error ||
                "Este link expirou ou já foi utilizado."}
            </div>

            <Link
              to="/esqueci-senha"
              className="password-recovery-primary"
            >
              Solicitar novo link
            </Link>

            <Link
              to="/login"
              className="password-recovery-back"
            >
              Voltar para o login
            </Link>
          </>
        ) : (
          <form onSubmit={submit}>
            <p className="password-recovery-account">
              Conta:
              <strong>{email}</strong>
            </p>

            {error && (
              <div className="password-recovery-message error">
                {error}
              </div>
            )}

            <label>
              Nova senha

              <div className="password-recovery-input">
                <LockKeyhole size={18} />

                <input
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) =>
                    setPassword(
                      event.target.value
                    )
                  }
                />

                <button
                  type="button"
                  className="password-eye"
                  onClick={() =>
                    setShowPassword(
                      (value) =>
                        !value
                    )
                  }
                  aria-label={
                    showPassword
                      ? "Ocultar senha"
                      : "Mostrar senha"
                  }
                >
                  {showPassword ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </label>

            <label>
              Confirmar nova senha

              <div className="password-recovery-input">
                <LockKeyhole size={18} />

                <input
                  type={
                    showConfirmation
                      ? "text"
                      : "password"
                  }
                  autoComplete="new-password"
                  value={confirmation}
                  onChange={(event) =>
                    setConfirmation(
                      event.target.value
                    )
                  }
                />

                <button
                  type="button"
                  className="password-eye"
                  onClick={() =>
                    setShowConfirmation(
                      (value) =>
                        !value
                    )
                  }
                >
                  {showConfirmation ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </label>

            <small className="password-recovery-hint">
              Mínimo de 8 caracteres.
            </small>

            <button
              type="submit"
              className="password-recovery-primary"
              disabled={saving}
            >
              {saving
                ? "Alterando..."
                : "Definir nova senha"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
