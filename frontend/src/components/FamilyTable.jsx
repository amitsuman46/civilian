const RELATIONS = [
  'WIFE','HUSBAND','SON','DAUGHTER','D-IN-LAW','S-IN-LAW',
  'G-SON','G-DAUGHTER','FATHER','MOTHER','BROTHER','SISTER',
  'UNCLE','AUNT','OTHER',
];

export default function FamilyTable({ members, onChange }) {
  const addRow = () =>
    onChange([...members, { name: '', relation: '', age: '', occupation: '', remarks: '' }]);

  const removeRow = (idx) => onChange(members.filter((_, i) => i !== idx));

  const update = (idx, field, value) =>
    onChange(members.map((m, i) => i === idx ? { ...m, [field]: value } : m));

  return (
    <>
      <div className="form-card-header" style={{ justifyContent: 'space-between' }}>
        <span><i className="fas fa-people-group"></i> Family Details</span>
        <button type="button" className="btn btn-success btn-sm" onClick={addRow}>
          <i className="fas fa-plus"></i> Add Member
        </button>
      </div>
      <div style={{ padding: 0, overflowX: 'auto' }}>
        {members.length > 0 && (
          <table className="family-table" id="familyTable">
            <thead>
              <tr>
                <th style={{ width: '44px' }}>Sr.</th>
                <th>Name</th>
                <th style={{ width: '160px' }}>Relation to Head</th>
                <th style={{ width: '90px' }}>Age</th>
                <th>Occupation</th>
                <th>Remarks</th>
                <th style={{ width: '48px' }}></th>
              </tr>
            </thead>
            <tbody>
              {members.map((m, i) => (
                <tr key={i}>
                  <td className="sr-cell"><span className="sr-num">{i + 1}</span></td>
                  <td>
                    <input
                      type="text" className="fm-name"
                      value={m.name} onChange={e => update(i, 'name', e.target.value)}
                      placeholder="Full name"
                    />
                  </td>
                  <td>
                    <select className="fm-relation" value={m.relation} onChange={e => update(i, 'relation', e.target.value)}>
                      <option value="">-- Select --</option>
                      {RELATIONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td>
                    <input
                      type="text" className="fm-age"
                      value={m.age} onChange={e => update(i, 'age', e.target.value)}
                      placeholder="e.g. 27" style={{ width: '110px' }}
                    />
                  </td>
                  <td>
                    <input
                      type="text" className="fm-occupation"
                      value={m.occupation} onChange={e => update(i, 'occupation', e.target.value)}
                      placeholder="e.g. Farmer"
                    />
                  </td>
                  <td>
                    <input
                      type="text" className="fm-remarks"
                      value={m.remarks} onChange={e => update(i, 'remarks', e.target.value)}
                      placeholder="Optional"
                    />
                  </td>
                  <td>
                    <button
                      type="button" className="btn-remove-row"
                      onClick={() => removeRow(i)} title="Remove"
                    >
                      <i className="fas fa-xmark"></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {members.length === 0 && (
          <div className="family-empty" style={{ display: 'flex' }}>
            <i className="fas fa-users"></i>
            <span>No family members added yet. Click <strong>+ Add Member</strong> to start.</span>
          </div>
        )}
      </div>
    </>
  );
}
