import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/auth";

export default function DeepLink() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [brandName, setBrandName] = useState("TaLock Chat");
  const [primaryColor, setPrimaryColor] = useState("#800000");
  const [secondaryColor, setSecondaryColor] = useState("#F1B82D");
  const [logoUrl, setLogoUrl] = useState("/ta-lock-logo.png");

  useEffect(() => {
    const exchangeToken = async () => {
      const lt = new URLSearchParams(window.location.search).get("lt");
      if (!lt) {
        navigate("/unauthorized?reason=missing_token", { replace: true });
        return;
      }

      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lti-session/exchange`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ launchToken: lt }),
          }
        );

        if (!response.ok) {
          navigate("/unauthorized?reason=network_error", { replace: true });
          return;
        }

        const data = await response.json();

        sessionStorage.setItem("talock_session", data.sessionToken);

        if (!data.claims || !data.claims.isDeepLink) {
             navigate("/unauthorized?reason=not_deep_link", { replace: true });
             return;
        }

        window.history.replaceState({}, "", "/deep-link");
        setLoading(false);
      } catch (err) {
        navigate("/unauthorized?reason=network_error", { replace: true });
      }
    };

    exchangeToken();
  }, [navigate]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const response = await apiFetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/lti-deep-link-response`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          selectedConfig: { brandName, primaryColor, secondaryColor, logoUrl }
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate deep link response");
      }

      const { jwt, returnUrl } = await response.json();

      const form = document.createElement("form");
      form.method = "POST";
      form.action = returnUrl;
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = "JWT";
      input.value = jwt;
      form.appendChild(input);
      document.body.appendChild(form);
      form.submit();
    } catch (err) {
      setError("An error occurred while saving the configuration. Please try again.");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="flex flex-col gap-6 w-full max-w-4xl bg-card p-8 rounded-xl shadow-lg border border-border">
        <h1 className="text-2xl font-bold text-foreground">Configure Tool Link</h1>

        {error && (
            <div className="bg-destructive/10 text-destructive text-sm px-4 py-3 rounded border border-destructive/20">
                {error}
            </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Brand Name</label>
                <Input value={brandName} onChange={(e) => setBrandName(e.target.value)} placeholder="TaLock Chat" />
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Primary Color</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-10 h-10 p-1 border border-input rounded cursor-pointer" />
                  <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="font-mono text-sm" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Secondary Color</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="w-10 h-10 p-1 border border-input rounded cursor-pointer" />
                  <Input value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="font-mono text-sm" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Logo URL</label>
                <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." onBlur={(e) => setLogoUrl(e.target.value)} />
              </div>

              <Button onClick={handleSubmit} disabled={submitting} className="mt-4">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save & Return to Canvas
              </Button>
            </div>

            <div className="flex flex-col items-center justify-center p-6 bg-muted/30 rounded-lg border border-border">
                <p className="text-sm text-muted-foreground mb-4 w-full text-left font-medium uppercase tracking-wider">Preview</p>
                <div className="w-full max-w-xs rounded-xl overflow-hidden shadow-md flex flex-col" style={{ border: `1px solid ${primaryColor}40` }}>
                    <div className="flex items-center gap-3 p-4 text-white" style={{ background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor}, ${primaryColor})` }}>
                        {logoUrl && <img src={logoUrl} alt="Logo" className="w-8 h-8 object-contain bg-white/10 rounded-full p-1" onError={(e) => e.currentTarget.style.display = 'none'} />}
                        <span className="font-semibold">{brandName}</span>
                    </div>
                    <div className="bg-background p-4 flex flex-col gap-3 h-32">
                        <div className="bg-muted rounded text-xs p-2 self-start w-3/4 animate-pulse h-8"></div>
                        <div className="rounded text-xs p-2 self-end w-2/3 h-8" style={{ backgroundColor: `${secondaryColor}20`, color: primaryColor }}></div>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
