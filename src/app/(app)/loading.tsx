// Shown instantly while a screen's data loads, so tab taps never feel frozen.
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <div className="navbar" aria-hidden>
        <div className="navbar-inner" />
      </div>
      <div className="large-title">
        <span className="skeleton" style={{ width: 170, height: 34 }} />
      </div>
      <div className="content stack-12">
        <span className="skeleton" style={{ height: 36, borderRadius: 10 }} />
        <span className="skeleton" style={{ height: 34, width: "80%", borderRadius: 17 }} />
      </div>
      <section className="section content">
        <div className="list">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="row" style={{ minHeight: 64 }}>
              <span className="skeleton" style={{ width: 36, height: 36, borderRadius: 18, flex: "none" }} />
              <div className="row-main stack-6">
                <span className="skeleton" style={{ width: `${60 - i * 6}%`, height: 14 }} />
                <span className="skeleton" style={{ width: `${85 - i * 9}%`, height: 4 }} />
              </div>
              <span className="skeleton" style={{ width: 56, height: 20 }} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
