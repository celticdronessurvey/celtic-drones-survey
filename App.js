import React, { useEffect, useRef, useState } from "react";

const GOOGLE_MAPS_API_KEY =
  (typeof process !== "undefined" &&
    process.env &&
    process.env.REACT_APP_GOOGLE_MAPS_API_KEY) ||
  "";

const BASE = { lat: 51.8985, lng: -8.4756, name: "Cork, Ireland" };

const SERVICES = {
  topographic: {
    label: "Topographic Survey",
    unitLabel: "Area (hectares)",
  },
  facade: {
    label: "Facade Survey",
    unitLabel: "Facade area (m²)",
  },
  residential: {
    label: "Residential Development Mapping",
    unitLabel: "Area (hectares)",
  },
  progress: {
    label: "Construction Progress Monitoring",
    unitLabel: "Number of visits",
  },
};

function Card({ children, className = "" }) {
  return <div className={`card ${className}`.trim()}>{children}</div>;
}

function Field({ label, children }) {
  return (
    <label className="field">
      <div className="field-label">{label}</div>
      {children}
    </label>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="info-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function FeatureCard({ title, text }) {
  return (
    <div className="feature-card">
      <div className="feature-title">{title}</div>
      <div className="feature-text">{text}</div>
    </div>
  );
}

export default function App() {
  const [form, setForm] = useState({
    clientName: "",
    company: "",
    email: "",
    phone: "",
    serviceType: "topographic",
    quantity: 5,
    visits: 1,
    buildingPerimeter: "",
    buildingHeight: "",
    location: "",
    eircode: "",
    latitude: "",
    longitude: "",
    roadRoundTripKm: 0,
    urgency: "standard",
    isTender: false,
    isTenderSupport: false,
    projectDescription: "",
    kmlReference: "",
  });

  const [mapsReady, setMapsReady] = useState(false);
  const [mapError, setMapError] = useState("");
  const [routeMessage, setRouteMessage] = useState(
    "Choose the project location on the map or enter the location manually."
  );
  const [showAdmin, setShowAdmin] = useState(false);
  const [leads, setLeads] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [confirmationMessage, setConfirmationMessage] = useState("");

  const mapElRef = useRef(null);
  const mapRef = useRef(null);
  const directionsRendererRef = useRef(null);
  const markerRef = useRef(null);

  const service = SERVICES[form.serviceType];

  const update = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const facadeArea =
    Number(form.buildingPerimeter || 0) * Number(form.buildingHeight || 0);

  const quantity =
    form.serviceType === "progress"
      ? Number(form.visits || 0)
      : form.serviceType === "facade"
      ? facadeArea
      : Number(form.quantity || 0);

  const tenderEligible =
    (form.serviceType === "topographic" ||
      form.serviceType === "residential") &&
    Number(form.quantity || 0) >= 300;

  let projectCategory = "standard";
  if (quantity < 10) projectCategory = "small";
  if (
    (form.serviceType === "topographic" ||
      form.serviceType === "residential") &&
    quantity >= 300
  ) {
    projectCategory = "large";
  }

  useEffect(() => {
    if (!tenderEligible && form.isTenderSupport) {
      setForm((prev) => ({ ...prev, isTenderSupport: false }));
    }
  }, [tenderEligible, form.isTenderSupport]);

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) {
      setMapError(
        "Google Maps API key not found. The form still works without the map."
      );
      return;
    }

    if (window.google && window.google.maps) {
      setMapsReady(true);
      return;
    }

    const existing = document.getElementById("google-maps-script");
    if (existing) {
      existing.addEventListener("load", () => setMapsReady(true));
      existing.addEventListener("error", () =>
        setMapError("Failed to load Google Maps.")
      );
      return;
    }

    const script = document.createElement("script");
    script.id = "google-maps-script";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => setMapsReady(true);
    script.onerror = () => setMapError("Failed to load Google Maps.");
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!mapsReady || !mapElRef.current || mapRef.current) return;

    const map = new window.google.maps.Map(mapElRef.current, {
      center: BASE,
      zoom: 7,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
    });

    mapRef.current = map;

    new window.google.maps.Marker({
      position: BASE,
      map,
      title: "Cork Base",
    });

    directionsRendererRef.current = new window.google.maps.DirectionsRenderer({
      map,
      suppressMarkers: false,
    });

    map.addListener("click", (event) => {
      const lat = event.latLng.lat();
      const lng = event.latLng.lng();

      update("latitude", lat.toFixed(6));
      update("longitude", lng.toFixed(6));
      update("roadRoundTripKm", 0);
      setRouteMessage(
        "Location selected. The project will be reviewed and a tailored quotation will be sent within 24 hours."
      );

      if (markerRef.current) markerRef.current.setMap(null);

      markerRef.current = new window.google.maps.Marker({
        position: { lat, lng },
        map,
        title: "Project location",
      });
    });
  }, [mapsReady]);

  const geocodeDestination = async () => {
    if (!window.google?.maps) {
      const lat = Number(form.latitude);
      const lng = Number(form.longitude);

      if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
        return { lat, lng, place: form.location || "Selected coordinates" };
      }

      throw new Error("Google Maps is not available.");
    }

    const geocoder = new window.google.maps.Geocoder();

    if (form.eircode.trim()) {
      const result = await geocoder.geocode({
        address: `${form.eircode}, Ireland`,
      });

      if (result.results?.length) {
        const location = result.results[0].geometry.location;
        return {
          lat: location.lat(),
          lng: location.lng(),
          place: result.results[0].formatted_address,
        };
      }
    }

    const lat = Number(form.latitude);
    const lng = Number(form.longitude);

    if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
      return { lat, lng, place: form.location || "Selected coordinates" };
    }

    if (form.location.trim()) {
      const result = await geocoder.geocode({
        address: `${form.location}, Ireland`,
      });

      if (result.results?.length) {
        const location = result.results[0].geometry.location;
        return {
          lat: location.lat(),
          lng: location.lng(),
          place: result.results[0].formatted_address,
        };
      }
    }

    throw new Error("No valid destination found.");
  };

  const calculateRoadRoute = async () => {
    const destination = await geocodeDestination();

    if (!window.google?.maps) {
      throw new Error("Map loaded without route service.");
    }

    const directionsService = new window.google.maps.DirectionsService();

    const routeResult = await directionsService.route({
      origin: BASE,
      destination: { lat: destination.lat, lng: destination.lng },
      travelMode: window.google.maps.TravelMode.DRIVING,
      provideRouteAlternatives: false,
    });

    const leg = routeResult.routes?.[0]?.legs?.[0];
    if (!leg?.distance?.value) {
      throw new Error("No route distance returned.");
    }

    const oneWayKm = leg.distance.value / 1000;
    const roundTripKm = Math.round(oneWayKm * 2);

    directionsRendererRef.current?.setDirections(routeResult);

    setForm((prev) => ({
      ...prev,
      location: prev.location || destination.place,
      latitude: String(destination.lat.toFixed(6)),
      longitude: String(destination.lng.toFixed(6)),
      roadRoundTripKm: roundTripKm,
    }));

    setRouteMessage(
      `Project route reviewed: ${roundTripKm} km round trip from Cork. Final quotation will be issued within 24 hours after review.`
    );

    return roundTripKm;
  };

  const handleSubmitRequest = async (e) => {
    e.preventDefault();

    let routeKm = form.roadRoundTripKm;

    try {
      if (GOOGLE_MAPS_API_KEY) {
        routeKm = await calculateRoadRoute();
      }
    } catch (error) {
      setRouteMessage(
        error.message ||
          "Project received. Our team will still review the enquiry manually."
      );
    }

    const newLead = {
      id: Date.now(),
      client: form.clientName || "Unnamed client",
      company: form.company || "-",
      email: form.email || "-",
      phone: form.phone || "-",
      service: service.label,
      location: form.location || "-",
      eircode: form.eircode || "-",
      latitude: form.latitude || "-",
      longitude: form.longitude || "-",
      distance: routeKm || 0,
      quantity:
        form.serviceType === "facade"
          ? `${facadeArea.toFixed(2)} m²`
          : form.serviceType === "progress"
          ? `${form.visits} visit(s)`
          : `${quantity} ha`,
      urgency: form.urgency,
      isTender: form.isTender ? "Yes" : "No",
      isTenderSupport: form.isTenderSupport ? "Yes" : "No",
      projectCategory,
      kmlReference: form.kmlReference || "-",
      description: form.projectDescription || "-",
      status: "Pending review",
    };

    setLeads((prev) => [newLead, ...prev]);
    setSubmitted(true);
    setConfirmationMessage(
      "Thank you. Your project request has been received successfully. Our team will review the details and send a tailored quotation to your email within 24 hours. If needed, we may contact you for additional information or a KML boundary file."
    );
  };

  return (
    <div className="app">
      <div className="container">
        <section className="landing-hero">
          <div className="landing-hero-text">
            <div className="small-title">
              DRONE SURVEY | TENDER SUPPORT | RAPID DATA DELIVERY
            </div>
            <h1>Helping clients win projects with rapid drone survey data.</h1>
            <p className="subtitle">
              We work in partnership with contractors, engineers and consultants
              to rapidly survey project areas and deliver essential data within
              short timeframes, allowing clients to progress tender submissions
              as early as possible.
            </p>
            <p className="desc">
              Practical drone-based support across Ireland for point clouds,
              topographic mapping, tender preparation, timelapse monitoring,
              photo corridor surveys and large-area project opportunities.
            </p>

            <div className="hero-badges">
              <span className="hero-badge">Point Clouds</span>
              <span className="hero-badge">Tender Support</span>
              <span className="hero-badge">Timelapse</span>
              <span className="hero-badge">Photo Corridor</span>
              <span className="hero-badge">300+ ha Projects</span>
            </div>

            {mapError ? <div className="error-box">{mapError}</div> : null}
          </div>

          <Card>
            <div className="small-title">PROJECT REVIEW</div>
            <h3>How we work</h3>
            <InfoRow
              label="Step 1"
              value="Submit project details through the website"
            />
            <InfoRow
              label="Step 2"
              value="Attach KML / boundary reference if available"
            />
            <InfoRow
              label="Step 3"
              value="Our team reviews scope, location and outputs required"
            />
            <InfoRow
              label="Step 4"
              value="Tailored quotation issued by email within 24 hours"
            />
            <InfoRow
              label="Focus"
              value="Fast response for tenders, planning and delivery support"
            />
          </Card>
        </section>

        <Card className="tender-highlight">
          <div className="small-title">STRATEGIC TENDER SUPPORT</div>
          <h2 style={{ marginTop: 0 }}>Support for tender-stage projects</h2>
          <p className="desc" style={{ maxWidth: "100%", marginBottom: 12 }}>
            Celtic Drones Survey supports selected clients during the tender
            phase by providing early-stage survey data quickly, efficiently and
            in a commercially structured way. Our objective is to help clients
            secure the information they need as early as possible, so they can
            prepare stronger, faster and more competitive tender submissions.
          </p>
          <div className="summary-grid">
            <InfoRow
              label="Availability"
              value="Topographic and Residential projects only"
            />
            <InfoRow label="Minimum area" value="Available from 300 hectares" />
            <InfoRow
              label="Commercial model"
              value="Tailored project review and structured tender-stage support"
            />
            <InfoRow
              label="Response time"
              value="Quotation typically issued within 24 hours"
            />
          </div>
          <div className="note" style={{ marginTop: 12 }}>
            We work in partnership with clients to rapidly capture the required
            site data and deliver practical information that supports faster and
            stronger tender preparation.
          </div>
        </Card>

        <section className="services-section">
          <div className="small-title">OUR SERVICES</div>
          <h2>
            Practical drone data solutions for tenders, planning and delivery
          </h2>
          <div className="features-grid">
            <FeatureCard
              title="Topographic Survey"
              text="Rapid terrain mapping, orthomosaics, point clouds and CAD-ready outputs for engineering and planning support."
            />
            <FeatureCard
              title="Residential Development Mapping"
              text="Drone mapping and point cloud support for development, planning and tender-stage site assessment."
            />
            <FeatureCard
              title="Facade Survey"
              text="High-resolution building capture for inspection support, visual analysis and modelling workflows."
            />
            <FeatureCard
              title="Construction Progress Monitoring"
              text="Repeat site visits and project imagery to document progress and support reporting."
            />
            <FeatureCard
              title="Timelapse Monitoring"
              text="Scheduled drone capture over time to create visual progress records for reporting and presentation."
            />
            <FeatureCard
              title="Photo Corridor Survey"
              text="Linear imagery and route documentation for roads, utilities, corridor works and infrastructure projects."
            />
            <FeatureCard
              title="Point Cloud Generation"
              text="Reliable drone-based point cloud outputs to support terrain understanding and technical decision-making."
            />
            <FeatureCard
              title="Tender Stage Support"
              text="Structured early-stage support to help clients access essential site data and prepare stronger submissions."
            />
          </div>
        </section>

        <Card className="why-early-card">
          <div className="small-title">WHY CLIENTS CONTACT US EARLY</div>
          <h2 style={{ marginTop: 0 }}>Fast response through the website</h2>
          <p className="desc" style={{ maxWidth: "100%", marginBottom: 12 }}>
            Our website is the main point of contact for new project enquiries,
            helping us respond quickly and provide the most appropriate
            technical solution as early as possible.
          </p>
          <div className="summary-grid">
            <InfoRow
              label="Rapid survey support"
              value="We quickly assess the project and capture the required area"
            />
            <InfoRow
              label="Useful outputs"
              value="Point clouds, orthomosaics, visual documentation and corridor imagery"
            />
            <InfoRow
              label="Tender focus"
              value="Strong support for early-stage tenders and new project opportunities"
            />
            <InfoRow
              label="Short timeframes"
              value="Essential information delivered as early as possible for bid preparation"
            />
          </div>
        </Card>

        {projectCategory === "large" && (
          <Card className="large-project">
            <div className="small-title">Large Area Survey</div>
            <h3>Large Scale Project Detected</h3>
            <p>
              This project exceeds <strong>300 hectares</strong> and may qualify
              for tailored operational planning and structured tender-stage
              support.
            </p>
            <p className="note">
              For projects of this scale we may optimise flight planning,
              mobilization strategy and processing workflow to ensure efficient
              coverage and rapid technical response.
            </p>
          </Card>
        )}

        <div className="grid">
          <Card>
            <h2>Request a Project Quotation</h2>

            {!submitted ? (
              <form onSubmit={handleSubmitRequest}>
                <Field label="Client name">
                  <input
                    className="input"
                    value={form.clientName}
                    onChange={(e) => update("clientName", e.target.value)}
                  />
                </Field>

                <Field label="Company">
                  <input
                    className="input"
                    value={form.company}
                    onChange={(e) => update("company", e.target.value)}
                  />
                </Field>

                <Field label="Email">
                  <input
                    className="input"
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                  />
                </Field>

                <Field label="Phone">
                  <input
                    className="input"
                    value={form.phone}
                    onChange={(e) => update("phone", e.target.value)}
                  />
                </Field>

                <Field label="Service type">
                  <select
                    className="input"
                    value={form.serviceType}
                    onChange={(e) => update("serviceType", e.target.value)}
                  >
                    {Object.entries(SERVICES).map(([key, item]) => (
                      <option key={key} value={key}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </Field>

                {form.serviceType === "progress" ? (
                  <Field label="Number of visits">
                    <input
                      className="input"
                      type="number"
                      min="1"
                      value={form.visits}
                      onChange={(e) => update("visits", e.target.value)}
                    />
                  </Field>
                ) : form.serviceType === "facade" ? (
                  <>
                    <Field label="Building perimeter (m)">
                      <input
                        className="input"
                        type="number"
                        value={form.buildingPerimeter}
                        onChange={(e) =>
                          update("buildingPerimeter", e.target.value)
                        }
                      />
                    </Field>
                    <Field label="Building height (m)">
                      <input
                        className="input"
                        type="number"
                        value={form.buildingHeight}
                        onChange={(e) =>
                          update("buildingHeight", e.target.value)
                        }
                      />
                    </Field>
                  </>
                ) : (
                  <Field label={service.unitLabel}>
                    <input
                      className="input"
                      type="number"
                      min="0"
                      step="0.1"
                      value={form.quantity}
                      onChange={(e) => update("quantity", e.target.value)}
                    />
                  </Field>
                )}

                {!tenderEligible &&
                  (form.serviceType === "topographic" ||
                    form.serviceType === "residential") && (
                    <div className="note">
                      Tender Stage Support becomes available for projects above
                      <strong> 300 hectares</strong>.
                    </div>
                  )}

                <Field label="Project location">
                  <input
                    className="input"
                    value={form.location}
                    onChange={(e) => update("location", e.target.value)}
                  />
                </Field>

                <Field label="Eircode">
                  <input
                    className="input"
                    value={form.eircode}
                    onChange={(e) => update("eircode", e.target.value)}
                  />
                </Field>

                <Field label="Latitude">
                  <input
                    className="input"
                    value={form.latitude}
                    onChange={(e) => update("latitude", e.target.value)}
                  />
                </Field>

                <Field label="Longitude">
                  <input
                    className="input"
                    value={form.longitude}
                    onChange={(e) => update("longitude", e.target.value)}
                  />
                </Field>

                <Field label="KML / KMZ file reference or boundary note">
                  <input
                    className="input"
                    value={form.kmlReference}
                    onChange={(e) => update("kmlReference", e.target.value)}
                    placeholder="Example: Boundary file available on request"
                  />
                </Field>

                <Field label="Project description">
                  <textarea
                    className="input"
                    value={form.projectDescription}
                    onChange={(e) =>
                      update("projectDescription", e.target.value)
                    }
                    placeholder="Describe the activity, site requirements, outputs required, tender context, timelines or any technical notes."
                  />
                </Field>

                {(form.serviceType === "topographic" ||
                  form.serviceType === "residential") && (
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={form.isTender}
                      onChange={(e) => update("isTender", e.target.checked)}
                    />
                    <span>
                      This project is related to a tender / public procurement
                      opportunity
                    </span>
                  </label>
                )}

                {tenderEligible && (
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={form.isTenderSupport}
                      onChange={(e) =>
                        update("isTenderSupport", e.target.checked)
                      }
                    />
                    <span>
                      This project may require{" "}
                      <strong>Tender Stage Support</strong>
                    </span>
                  </label>
                )}

                <Field label="Urgency">
                  <select
                    className="input"
                    value={form.urgency}
                    onChange={(e) => update("urgency", e.target.value)}
                  >
                    <option value="standard">Standard</option>
                    <option value="express">Express</option>
                  </select>
                </Field>

                <div className="note">
                  Please submit the project details and, if available, a KML or
                  boundary reference. Our team will review the request and send
                  a tailored quotation by email within <strong>24 hours</strong>
                  .
                </div>

                <div className="note">{routeMessage}</div>

                <button className="btn" type="submit">
                  Submit Project Request
                </button>
              </form>
            ) : (
              <div className="success-box">
                <div className="small-title">REQUEST RECEIVED</div>
                <h3 style={{ marginTop: 0 }}>Thank you for contacting us</h3>
                <p className="desc" style={{ maxWidth: "100%" }}>
                  {confirmationMessage}
                </p>
                <div className="summary-grid" style={{ marginTop: 16 }}>
                  <InfoRow label="Client" value={form.clientName || "-"} />
                  <InfoRow label="Service" value={service.label} />
                  <InfoRow label="Location" value={form.location || "-"} />
                  <InfoRow label="Project category" value={projectCategory} />
                  <InfoRow
                    label="Response time"
                    value="Quotation within 24 hours"
                  />
                </div>
              </div>
            )}
          </Card>

          <Card>
            <h2>Project Location Map</h2>
            <p className="map-help">
              Click on the map to define the project location. This helps our
              team review access, route planning and project context before
              issuing your tailored quotation.
            </p>
            <div ref={mapElRef} className="map-box" />
          </Card>
        </div>

        <Card>
          <div className="pdf-head">
            <h2>What happens next</h2>
          </div>
          <div className="summary-grid">
            <InfoRow
              label="1. Project received"
              value="Your enquiry is registered for internal review"
            />
            <InfoRow
              label="2. Technical assessment"
              value="We review scope, location, boundaries and required outputs"
            />
            <InfoRow
              label="3. Tailored quotation"
              value="A customised quotation is issued by email within 24 hours"
            />
            <InfoRow
              label="4. Follow-up"
              value="If needed, we contact you for clarification or boundary files"
            />
          </div>
        </Card>

        <Card>
          <div className="pdf-head">
            <h2>Admin Dashboard</h2>
            <button
              className="secondary-btn"
              type="button"
              onClick={() => setShowAdmin((prev) => !prev)}
            >
              {showAdmin ? "Hide Admin" : "Show Admin"}
            </button>
          </div>

          {showAdmin ? (
            <div className="summary-grid">
              {leads.length === 0 ? (
                <div className="note">No project requests yet.</div>
              ) : (
                leads.map((lead) => (
                  <div key={lead.id} className="pricing-row">
                    <div className="pricing-service">{lead.client}</div>
                    <div className="pricing-meta">Company: {lead.company}</div>
                    <div className="pricing-meta">Email: {lead.email}</div>
                    <div className="pricing-meta">Phone: {lead.phone}</div>
                    <div className="pricing-meta">Service: {lead.service}</div>
                    <div className="pricing-meta">
                      Location: {lead.location}
                    </div>
                    <div className="pricing-meta">
                      Category: {lead.projectCategory}
                    </div>
                    <div className="pricing-meta">
                      Quantity: {lead.quantity}
                    </div>
                    <div className="pricing-meta">
                      Distance: {lead.distance} km
                    </div>
                    <div className="pricing-meta">Tender: {lead.isTender}</div>
                    <div className="pricing-meta">
                      Tender Support: {lead.isTenderSupport}
                    </div>
                    <div className="pricing-meta">
                      Boundary note: {lead.kmlReference}
                    </div>
                    <div className="pricing-meta">Status: {lead.status}</div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="note">
              Admin panel hidden. Click “Show Admin” to review incoming project
              requests.
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
