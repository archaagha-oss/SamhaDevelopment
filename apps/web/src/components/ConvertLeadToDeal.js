import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "sonner";

function Modal({ title, onClose, children }) {
  return _jsx("div", {
    className: "fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4",
    onClick: onClose,
    children: _jsxs("div", {
      className: "bg-white rounded-2xl w-full max-w-2xl shadow-2xl",
      onClick: (e) => e.stopPropagation(),
      children: [
        _jsxs("div", {
          className: "flex items-center justify-between px-6 py-4 border-b border-slate-200",
          children: [
            _jsx("h2", {
              className: "font-semibold text-slate-900",
              children: title,
            }),
            _jsx("button", {
              onClick: onClose,
              className: "text-slate-400 hover:text-slate-600 text-2xl leading-none",
              children: "×",
            }),
          ],
        }),
        _jsx("div", { className: "px-6 py-5 max-h-[70vh] overflow-y-auto", children }),
      ],
    }),
  });
}

export default function ConvertLeadToDeal({
  leadId,
  lead = {},
  onClose,
  onSuccess,
}) {
  const [step, setStep] = useState(1); // 1: Unit selection, 2: Terms, 3: Broker, 4: Review
  const [loading, setLoading] = useState(false);
  const [units, setUnits] = useState([]);
  const [paymentPlans, setPaymentPlans] = useState([]);
  const [brokerCompanies, setBrokerCompanies] = useState([]);
  const [brokerAgents, setBrokerAgents] = useState([]);

  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [salePrice, setSalePrice] = useState(lead.budget || "");
  const [discount, setDiscount] = useState("0");
  const [reservationAmount, setReservationAmount] = useState("");
  const [paymentPlanId, setPaymentPlanId] = useState("");
  const [brokerCompanyId, setBrokerCompanyId] = useState("");
  const [brokerAgentId, setBrokerAgentId] = useState("");
  const [notes, setNotes] = useState("");

  const [creating, setCreating] = useState(false);

  // Load initial data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [unitsRes, plansRes, brokersRes] = await Promise.all([
          axios.get("/api/units", {
            params: {
              status: "AVAILABLE",
              limit: "100",
            },
          }),
          axios.get("/api/payment-plans", { params: { isActive: true } }),
          axios.get("/api/brokers"),
        ]);

        const filtered = unitsRes.data.data.filter(
          (u) => !lead.budget || (u.price >= lead.budget * 0.8 && u.price <= lead.budget * 1.2)
        );

        setUnits(filtered);
        setPaymentPlans(plansRes.data || []);
        setBrokerCompanies(brokersRes.data || []);

        // Set defaults
        if (filtered.length > 0) setSelectedUnitId(filtered[0].id);
        if (plansRes.data?.length > 0) setPaymentPlanId(plansRes.data[0].id);
      } catch (error) {
        toast.error("Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [lead.budget]);

  // Load broker agents when company changes
  useEffect(() => {
    if (!brokerCompanyId) {
      setBrokerAgents([]);
      return;
    }

    axios
      .get(`/api/brokers/${brokerCompanyId}/agents`)
      .then((res) => setBrokerAgents(res.data || []))
      .catch(() => setBrokerAgents([]));
  }, [brokerCompanyId]);

  const selectedUnit = units.find((u) => u.id === selectedUnitId);
  const selectedPlan = paymentPlans.find((p) => p.id === paymentPlanId);
  const selectedBroker = brokerCompanies.find((b) => b.id === brokerCompanyId);

  const discountAmount = discount ? (parseFloat(salePrice) * parseFloat(discount)) / 100 : 0;
  const netPrice = parseFloat(salePrice) - discountAmount;

  const handleCreateDeal = async () => {
    if (!selectedUnitId || !salePrice || !paymentPlanId) {
      toast.error("Please fill in all required fields");
      return;
    }

    setCreating(true);
    try {
      const response = await axios.post("/api/deals", {
        leadId,
        unitId: selectedUnitId,
        salePrice: parseFloat(salePrice),
        discount: discountAmount,
        reservationAmount: reservationAmount ? parseFloat(reservationAmount) : 0,
        paymentPlanId,
        brokerCompanyId: brokerCompanyId || null,
        brokerAgentId: brokerAgentId || null,
        notes: notes || null,
        createdBy: "current-user",
      });

      toast.success("Deal created successfully!");
      onSuccess?.(response.data);
      onClose?.();
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to create deal");
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return _jsx(Modal, {
      title: "Convert Lead to Deal",
      onClose,
      children: _jsx("div", {
        className: "flex items-center justify-center py-8",
        children: _jsx("div", {
          className: "w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin",
        }),
      }),
    });
  }

  return _jsx(Modal, {
    title: "Convert Lead to Deal",
    onClose,
    children: _jsxs("div", {
      className: "space-y-6",
      children: [
        // Steps indicator
        _jsxs("div", {
          className: "flex justify-between",
          children: [
            { num: 1, label: "Unit" },
            { num: 2, label: "Terms" },
            { num: 3, label: "Broker" },
            { num: 4, label: "Review" },
          ].map(({ num, label }) =>
            _jsxs("div", {
              className: "flex-1 text-center",
              children: [
                _jsx("div", {
                  className: `w-8 h-8 rounded-full mx-auto mb-1 flex items-center justify-center text-sm font-medium ${
                    num <= step
                      ? "bg-blue-600 text-white"
                      : "bg-slate-200 text-slate-600"
                  }`,
                  children: num,
                }),
                _jsx("span", {
                  className: "text-xs text-slate-600",
                  children: label,
                }),
              ],
            }, num)
          ),
        }),

        // Step 1: Unit selection
        step === 1 && _jsxs("div", {
          className: "space-y-4",
          children: [
            _jsx("h3", {
              className: "font-medium text-slate-900",
              children: "Select Unit",
            }),
            _jsxs("select", {
              value: selectedUnitId,
              onChange: (e) => setSelectedUnitId(e.target.value),
              className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white",
              children: [
                _jsx("option", { value: "", children: "Choose a unit..." }),
                units.map((u) =>
                  _jsx("option", {
                    value: u.id,
                    children: `${u.unitNumber} (${u.type}) - ${new Intl.NumberFormat("en-AE", {
                      style: "currency",
                      currency: "AED",
                      minimumFractionDigits: 0,
                    }).format(u.price)}`,
                  }, u.id)
                ),
              ],
            }),
            selectedUnit && _jsxs("div", {
              className: "bg-blue-50 p-3 rounded-lg text-sm",
              children: [
                _jsx("p", {
                  className: "font-medium text-blue-900",
                  children: `Unit ${selectedUnit.unitNumber}`,
                }),
                _jsx("p", {
                  className: "text-blue-700 text-xs mt-1",
                  children: `${selectedUnit.type} • Floor ${selectedUnit.floor} • ${selectedUnit.area}m²`,
                }),
              ],
            }),
            _jsx("button", {
              onClick: () => setStep(2),
              disabled: !selectedUnitId,
              className: "w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50 hover:bg-blue-700",
              children: "Next →",
            }),
          ],
        }),

        // Step 2: Deal terms
        step === 2 && _jsxs("div", {
          className: "space-y-4",
          children: [
            _jsx("h3", {
              className: "font-medium text-slate-900",
              children: "Deal Terms",
            }),
            _jsxs("div", {
              children: [
                _jsx("label", {
                  className: "block text-sm font-medium text-slate-700 mb-1",
                  children: "Sale Price (AED)",
                }),
                _jsx("input", {
                  type: "number",
                  value: salePrice,
                  onChange: (e) => setSalePrice(e.target.value),
                  className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400",
                }),
              ],
            }),
            _jsxs("div", {
              className: "grid grid-cols-2 gap-3",
              children: [
                _jsxs("div", {
                  children: [
                    _jsx("label", {
                      className: "block text-sm font-medium text-slate-700 mb-1",
                      children: "Discount %",
                    }),
                    _jsx("input", {
                      type: "number",
                      value: discount,
                      onChange: (e) => setDiscount(e.target.value),
                      className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400",
                    }),
                  ],
                }),
                _jsxs("div", {
                  children: [
                    _jsx("label", {
                      className: "block text-sm font-medium text-slate-700 mb-1",
                      children: "Reservation (AED)",
                    }),
                    _jsx("input", {
                      type: "number",
                      value: reservationAmount,
                      onChange: (e) => setReservationAmount(e.target.value),
                      className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400",
                    }),
                  ],
                }),
              ],
            }),
            _jsxs("div", {
              children: [
                _jsx("label", {
                  className: "block text-sm font-medium text-slate-700 mb-1",
                  children: "Payment Plan",
                }),
                _jsxs("select", {
                  value: paymentPlanId,
                  onChange: (e) => setPaymentPlanId(e.target.value),
                  className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white",
                  children: [
                    _jsx("option", { value: "", children: "Select a plan..." }),
                    paymentPlans.map((p) =>
                      _jsx("option", { value: p.id, children: p.name }, p.id)
                    ),
                  ],
                }),
              ],
            }),
            _jsxs("div", {
              className: "bg-slate-100 p-3 rounded-lg text-sm",
              children: [
                _jsxs("div", {
                  className: "flex justify-between",
                  children: [
                    _jsx("span", { children: "Price:" }),
                    _jsx("span", {
                      className: "font-medium",
                      children: new Intl.NumberFormat("en-AE", {
                        style: "currency",
                        currency: "AED",
                      }).format(parseFloat(salePrice) || 0),
                    }),
                  ],
                }),
                discountAmount > 0 && _jsxs("div", {
                  className: "flex justify-between text-red-600",
                  children: [
                    _jsx("span", { children: "Discount:" }),
                    _jsx("span", {
                      children: `-${new Intl.NumberFormat("en-AE", {
                        style: "currency",
                        currency: "AED",
                      }).format(discountAmount)}`,
                    }),
                  ],
                }),
                _jsxs("div", {
                  className: "flex justify-between font-medium text-blue-600 pt-2 border-t border-slate-300 mt-2",
                  children: [
                    _jsx("span", { children: "Net Price:" }),
                    _jsx("span", {
                      children: new Intl.NumberFormat("en-AE", {
                        style: "currency",
                        currency: "AED",
                      }).format(netPrice || 0),
                    }),
                  ],
                }),
              ],
            }),
            _jsxs("div", {
              className: "flex gap-3",
              children: [
                _jsx("button", {
                  onClick: () => setStep(1),
                  className: "flex-1 px-4 py-2 border border-slate-300 rounded-lg font-medium hover:bg-slate-50",
                  children: "← Back",
                }),
                _jsx("button", {
                  onClick: () => setStep(3),
                  className: "flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700",
                  children: "Next →",
                }),
              ],
            }),
          ],
        }),

        // Step 3: Broker (optional)
        step === 3 && _jsxs("div", {
          className: "space-y-4",
          children: [
            _jsx("h3", {
              className: "font-medium text-slate-900",
              children: "Broker Info (Optional)",
            }),
            _jsxs("div", {
              children: [
                _jsx("label", {
                  className: "block text-sm font-medium text-slate-700 mb-1",
                  children: "Broker Company",
                }),
                _jsxs("select", {
                  value: brokerCompanyId,
                  onChange: (e) => {
                    setBrokerCompanyId(e.target.value);
                    setBrokerAgentId("");
                  },
                  className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white",
                  children: [
                    _jsx("option", { value: "", children: "None" }),
                    brokerCompanies.map((b) =>
                      _jsx("option", { value: b.id, children: b.name }, b.id)
                    ),
                  ],
                }),
              ],
            }),
            brokerCompanyId && _jsxs("div", {
              children: [
                _jsx("label", {
                  className: "block text-sm font-medium text-slate-700 mb-1",
                  children: "Broker Agent",
                }),
                _jsxs("select", {
                  value: brokerAgentId,
                  onChange: (e) => setBrokerAgentId(e.target.value),
                  className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 bg-white",
                  children: [
                    _jsx("option", { value: "", children: "Select agent..." }),
                    brokerAgents.map((a) =>
                      _jsx("option", { value: a.id, children: a.name }, a.id)
                    ),
                  ],
                }),
              ],
            }),
            _jsxs("div", {
              children: [
                _jsx("label", {
                  className: "block text-sm font-medium text-slate-700 mb-1",
                  children: "Notes",
                }),
                _jsx("textarea", {
                  value: notes,
                  onChange: (e) => setNotes(e.target.value),
                  placeholder: "Add any deal notes...",
                  rows: 3,
                  className: "w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400",
                }),
              ],
            }),
            _jsxs("div", {
              className: "flex gap-3",
              children: [
                _jsx("button", {
                  onClick: () => setStep(2),
                  className: "flex-1 px-4 py-2 border border-slate-300 rounded-lg font-medium hover:bg-slate-50",
                  children: "← Back",
                }),
                _jsx("button", {
                  onClick: () => setStep(4),
                  className: "flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700",
                  children: "Next →",
                }),
              ],
            }),
          ],
        }),

        // Step 4: Review
        step === 4 && _jsxs("div", {
          className: "space-y-4",
          children: [
            _jsx("h3", {
              className: "font-medium text-slate-900",
              children: "Review & Create",
            }),
            _jsxs("div", {
              className: "bg-slate-50 rounded-lg p-4 space-y-3 text-sm",
              children: [
                _jsxs("div", {
                  className: "flex justify-between",
                  children: [
                    _jsx("span", { className: "text-slate-600", children: "Lead:" }),
                    _jsx("span", {
                      className: "font-medium",
                      children: `${lead.firstName} ${lead.lastName}`,
                    }),
                  ],
                }),
                _jsxs("div", {
                  className: "flex justify-between",
                  children: [
                    _jsx("span", { className: "text-slate-600", children: "Unit:" }),
                    _jsx("span", {
                      className: "font-medium",
                      children: selectedUnit ? `${selectedUnit.unitNumber} (${selectedUnit.type})` : "—",
                    }),
                  ],
                }),
                _jsxs("div", {
                  className: "flex justify-between",
                  children: [
                    _jsx("span", { className: "text-slate-600", children: "Sale Price:" }),
                    _jsx("span", {
                      className: "font-medium",
                      children: new Intl.NumberFormat("en-AE", {
                        style: "currency",
                        currency: "AED",
                      }).format(parseFloat(salePrice) || 0),
                    }),
                  ],
                }),
                discountAmount > 0 && _jsxs("div", {
                  className: "flex justify-between text-red-600",
                  children: [
                    _jsx("span", { children: "Discount:" }),
                    _jsx("span", {
                      children: `-${new Intl.NumberFormat("en-AE", {
                        style: "currency",
                        currency: "AED",
                      }).format(discountAmount)}`,
                    }),
                  ],
                }),
                _jsxs("div", {
                  className: "flex justify-between pt-2 border-t border-slate-200 font-medium",
                  children: [
                    _jsx("span", { children: "Net Price:" }),
                    _jsx("span", {
                      children: new Intl.NumberFormat("en-AE", {
                        style: "currency",
                        currency: "AED",
                      }).format(netPrice || 0),
                    }),
                  ],
                }),
                _jsxs("div", {
                  className: "flex justify-between",
                  children: [
                    _jsx("span", { className: "text-slate-600", children: "Payment Plan:" }),
                    _jsx("span", {
                      className: "font-medium",
                      children: selectedPlan?.name || "—",
                    }),
                  ],
                }),
                selectedBroker && _jsxs("div", {
                  className: "flex justify-between",
                  children: [
                    _jsx("span", { className: "text-slate-600", children: "Broker:" }),
                    _jsx("span", {
                      className: "font-medium",
                      children: selectedBroker.name,
                    }),
                  ],
                }),
              ],
            }),
            _jsxs("div", {
              className: "flex gap-3",
              children: [
                _jsx("button", {
                  onClick: () => setStep(3),
                  className: "flex-1 px-4 py-2 border border-slate-300 rounded-lg font-medium hover:bg-slate-50",
                  children: "← Back",
                }),
                _jsx("button", {
                  onClick: handleCreateDeal,
                  disabled: creating,
                  className: "flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50",
                  children: creating ? "Creating..." : "Create Deal ✓",
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  });
}
