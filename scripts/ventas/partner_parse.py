"""Parse Odoo partner names into project, tower, unit, and model.

The templates are the ones in docs/db-ventas.md. A token that template does
not prove stays out of project, tower, unit, and model. DS- is a
desistimiento marker. CD- is not.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

_TYPO = ("02-04DS-05", "DS-02-0405")
_CODE = r"[A-E]\d{1,2}(?:\.\d+)?"

_RE_03 = re.compile(
    r"^03\s*-\s*T([A-E])\s*-\s*(\d+)\s*-\s*([A-Za-z])"
    r"(?:\s*-\s*(\d+))?"
    r"(?:\s*-\s*|\s+)?(.*)$",
    re.IGNORECASE,
)
_RE_BNT = re.compile(
    r"^BNT\s*-\s*(\d+)\s*-\s*M([A-Za-z])\s*-\s*T([A-E])"
    r"(?:\s*-\s*(\d+))?"
    r"(?:\s*-\s*|\s+)?(.*)$",
    re.IGNORECASE,
)
_RE_02 = re.compile(
    rf"^02\s*-\s*(\d{{3,4}})\s*-\s*({_CODE})"
    rf"(?:\s*-\s*(GV1|GV|\d+))?"
    rf"(?:\s*-\s*|\s+)?(.*)$",
    re.IGNORECASE,
)
_RE_BLT = re.compile(
    rf"^BLT-?\s*(\d+)\s*-\s*M([A-Za-z])\s*-\s*T([A-E])"
    rf"(?:\s*-\s*(\d+))?"
    rf"(?:\s*-\s*|\s+)?(.*)$",
    re.IGNORECASE,
)
_RE_C = re.compile(
    r"^C\s*-\s*(\d+)\s*-\s*(\d+)\s*-\s*([A-Za-z](?:\s+PLUS)?)"
    r"(?:\s*-\s*|\s+)?(\d+)?"
    r"(?:\s*-\s*|\s+)?(.*)$",
    re.IGNORECASE,
)
_RE_01_SPACE = re.compile(
    r"^01\s*-\s*(\d{2})\s*-\s*([A-Za-z])\s+(\d+)"
    r"(?:\s*-\s*(\d+))?"
    r"(?:\s*-\s*|\s+)?(.*)$",
    re.IGNORECASE,
)
_RE_01_SKELETON = re.compile(
    rf"^01\s*-\s*(\d+)\s*-\s*({_CODE})(?:\s*-\s*(GV1|GV|\d+))?(?:\s*-\s*|\s+)?(.*)$",
    re.IGNORECASE,
)
_RE_CD12 = re.compile(
    rf"^CD-12\s*-\s*(\d{{4}})\s*-\s*({_CODE})\s*-\s*(.+)$",
    re.IGNORECASE,
)
_RE_BN = re.compile(r"^BN\s*-", re.IGNORECASE)
_RE_CASA = re.compile(r"^CASA\s+(\d+)$", re.IGNORECASE)


@dataclass(frozen=True)
class ParsedPartner:
    desistimiento_prefix: bool
    cd_prefix: bool
    project_name: str | None
    tower_name: str | None
    canonical_unit: str | None
    model_name: str | None
    buyer_name: str | None
    unproven_token: str | None


def canonical_unit(token: str | None) -> str | None:
    if token is None:
        return None
    text = token.strip()
    if text == "":
        return None
    if text.isdigit():
        stripped = text.lstrip("0")
        return stripped or "0"
    return text


def _clean(value: str | None) -> str | None:
    if value is None:
        return None
    text = " ".join(value.split()).strip(" -")
    return text or None


def _join_unproven(*parts: str | None) -> str | None:
    kept = [part for part in (_clean(part) for part in parts) if part]
    return " ".join(kept) or None


def _result(
    *,
    desistimiento: bool,
    cd: bool,
    project: str | None = None,
    tower: str | None = None,
    unit: str | None = None,
    model: str | None = None,
    buyer: str | None = None,
    unproven: str | None = None,
) -> ParsedPartner:
    return ParsedPartner(
        desistimiento_prefix=desistimiento,
        cd_prefix=cd,
        project_name=project,
        tower_name=tower,
        canonical_unit=canonical_unit(unit),
        model_name=_clean(model),
        buyer_name=_clean(buyer),
        unproven_token=_clean(unproven),
    )


def _strip_prefixes(name: str) -> tuple[str, bool, bool]:
    desistimiento = False
    cd = False
    while True:
        if name.upper().startswith("DS-"):
            desistimiento = True
            name = name[3:].lstrip()
            continue
        if name.upper().startswith("CD-") and not name.upper().startswith("CD-12-"):
            cd = True
            name = name[3:].lstrip()
            continue
        break
    return name, desistimiento, cd


def parse_partner_name(raw: str | None) -> ParsedPartner:
    if raw is None or not str(raw).strip():
        return _result(desistimiento=False, cd=False)

    name = " ".join(str(raw).replace(_TYPO[0], _TYPO[1]).split())
    if name.upper().startswith("CD-12-"):
        match = _RE_CD12.match(name)
        if match:
            return _result(
                desistimiento=False,
                cd=True,
                unit=match.group(1),
                unproven=match.group(2),
                buyer=match.group(3),
            )
        return _result(desistimiento=False, cd=True, unproven=name)

    name, desistimiento, cd = _strip_prefixes(name)
    upper = name.upper()

    match = _RE_03.match(name)
    if match:
        return _result(
            desistimiento=desistimiento,
            cd=cd,
            project="Benestare",
            tower=match.group(1).upper(),
            unit=match.group(2),
            model=match.group(3).upper(),
            buyer=match.group(5),
        )

    match = _RE_BNT.match(name)
    if match:
        return _result(
            desistimiento=desistimiento,
            cd=cd,
            project="Benestare",
            tower=match.group(3).upper(),
            unit=match.group(1),
            model=match.group(2).upper(),
            buyer=match.group(5),
        )

    if upper.startswith("03") or upper.startswith("BNT"):
        return _result(desistimiento=desistimiento, cd=cd, project="Benestare")

    match = _RE_02.match(name)
    if match:
        extra = match.group(3)
        return _result(
            desistimiento=desistimiento,
            cd=cd,
            project="Boulevard 5",
            tower="Principal",
            unit=match.group(1),
            buyer=match.group(4),
            unproven=_join_unproven(match.group(2).upper(), extra.upper() if extra else None),
        )

    if upper.startswith("02"):
        return _result(
            desistimiento=desistimiento,
            cd=cd,
            project="Boulevard 5",
        )

    match = _RE_BLT.match(name)
    if match:
        return _result(
            desistimiento=desistimiento,
            cd=cd,
            project="Bosque Las Tapias",
            tower=match.group(3).upper(),
            unit=match.group(1),
            buyer=match.group(5),
            unproven=f"M{match.group(2).upper()}",
        )

    if upper.startswith("BLT"):
        return _result(
            desistimiento=desistimiento,
            cd=cd,
            project="Bosque Las Tapias",
        )

    match = _RE_C.match(name)
    if match:
        return _result(
            desistimiento=desistimiento,
            cd=cd,
            project="Bosque Las Tapias",
            tower="C",
            unit=match.group(2),
            model=" ".join(match.group(3).upper().split()),
            buyer=match.group(5),
        )

    match = _RE_01_SPACE.match(name)
    if match:
        return _result(
            desistimiento=desistimiento,
            cd=cd,
            project="Casa Elisa",
            tower="Principal",
            unit=match.group(1),
            buyer=match.group(5),
            unproven=match.group(2).upper(),
        )

    match = _RE_01_SKELETON.match(name)
    if match:
        extra = match.group(3)
        return _result(
            desistimiento=desistimiento,
            cd=cd,
            project="Casa Elisa",
            tower="Principal",
            unproven=_join_unproven(match.group(1), match.group(2).upper(), extra.upper() if extra else None),
            buyer=match.group(4),
        )

    if upper.startswith("01"):
        return _result(desistimiento=desistimiento, cd=cd, project="Casa Elisa")

    match = _RE_CASA.match(name)
    if match:
        return _result(
            desistimiento=desistimiento,
            cd=cd,
            project="Santa Elena",
            unit=match.group(1),
        )

    if _RE_BN.match(name):
        return _result(desistimiento=desistimiento, cd=cd, unproven=name)

    return _result(desistimiento=desistimiento, cd=cd)


def self_check() -> None:
    def expect(raw: str, **fields: object) -> None:
        parsed = parse_partner_name(raw)
        for key, expected in fields.items():
            actual = getattr(parsed, key)
            if actual != expected:
                raise AssertionError(f"{raw!r} {key}: {actual!r} != {expected!r}")

    expect(
        "03-TB-0203-B",
        project_name="Benestare",
        tower_name="B",
        canonical_unit="203",
        model_name="B",
        buyer_name=None,
    )
    expect(
        "DS-03-TB-0107-A-09-NOMBRE",
        desistimiento_prefix=True,
        project_name="Benestare",
        tower_name="B",
        canonical_unit="107",
        model_name="A",
        buyer_name="NOMBRE",
    )
    expect(
        "BNT-108-MC-TA-8-NOMBRE",
        project_name="Benestare",
        tower_name="A",
        canonical_unit="108",
        model_name="C",
        buyer_name="NOMBRE",
    )
    expect("03-NOT-A-SHAPE", project_name="Benestare", canonical_unit=None, tower_name=None)
    expect(
        "02-0101-A7.1-04-NOMBRE",
        project_name="Boulevard 5",
        tower_name="Principal",
        canonical_unit="101",
        model_name=None,
        unproven_token="A7.1 04",
        buyer_name="NOMBRE",
    )
    expect(
        "02-0203-B6",
        project_name="Boulevard 5",
        canonical_unit="203",
        model_name=None,
        unproven_token="B6",
    )
    expect(
        "02-1203-B6-NOMBRE",
        canonical_unit="1203",
    )
    expect(
        "DS-02-0105-B7-NOMBRE",
        desistimiento_prefix=True,
        cd_prefix=False,
        canonical_unit="105",
    )
    expect(
        "02-04DS-05-B7-05-NOMBRE",
        desistimiento_prefix=True,
        project_name="Boulevard 5",
        canonical_unit="405",
        unproven_token="B7 05",
    )
    expect(
        "CD-02-0101-A1-NOMBRE",
        cd_prefix=True,
        desistimiento_prefix=False,
        project_name="Boulevard 5",
        canonical_unit="101",
    )
    expect(
        "BLT- 1305-MA-TB-025-NOMBRE",
        project_name="Bosque Las Tapias",
        tower_name="B",
        canonical_unit="1305",
        model_name=None,
        unproven_token="MA",
        buyer_name="NOMBRE",
    )
    expect(
        "BLT1305-MC-TB",
        project_name="Bosque Las Tapias",
        tower_name="B",
        canonical_unit="1305",
        unproven_token="MC",
    )
    expect(
        "C-5-506-B- 05-NOMBRE",
        project_name="Bosque Las Tapias",
        tower_name="C",
        canonical_unit="506",
        model_name="B",
        buyer_name="NOMBRE",
    )
    expect(
        "C-9-909-A PLUS-07-NOMBRE",
        tower_name="C",
        canonical_unit="909",
        model_name="A PLUS",
    )
    expect(
        "01-01-A 22 NOMBRE",
        project_name="Casa Elisa",
        tower_name="Principal",
        canonical_unit="1",
        model_name=None,
        unproven_token="A",
        buyer_name="NOMBRE",
    )
    expect(
        "01-101-B1-NOMBRE",
        project_name="Casa Elisa",
        tower_name="Principal",
        canonical_unit=None,
        unproven_token="101 B1",
    )
    expect("01-NO-TEMPLATE", project_name="Casa Elisa", canonical_unit=None, tower_name=None)
    expect(
        "CASA 1",
        project_name="Santa Elena",
        tower_name=None,
        canonical_unit="1",
        model_name=None,
    )
    expect("CASA 10", canonical_unit="10")
    expect("CASA Y ESTILO", project_name=None, canonical_unit=None)
    expect(
        "03-TA-0101-B-10",
        project_name="Benestare",
        tower_name="A",
        canonical_unit="101",
        model_name="B",
        buyer_name=None,
    )
    expect(
        "BNT-101-MB-TA-11 NOMBRE",
        project_name="Benestare",
        tower_name="A",
        canonical_unit="101",
        model_name="B",
        buyer_name="NOMBRE",
    )
    expect("BNT-306-TB-MB-20", project_name="Benestare", canonical_unit=None, tower_name=None)
    expect(
        "C-6-609-B NOMBRE",
        project_name="Bosque Las Tapias",
        tower_name="C",
        canonical_unit="609",
        model_name="B",
        buyer_name="NOMBRE",
    )
    expect("C-8-808-07-NOMBRE", project_name=None, canonical_unit=None)
    expect(
        "CD-12-1208-C6-NOMBRE",
        cd_prefix=True,
        project_name=None,
        tower_name=None,
        canonical_unit="1208",
        model_name=None,
        unproven_token="C6",
    )
    expect("BN-123-TA-MB", project_name=None, canonical_unit=None, tower_name=None, model_name=None)
    if canonical_unit("0203") != "203" or canonical_unit("1203") == canonical_unit("203"):
        raise AssertionError("canonical unit rule failed")
    if canonical_unit("L-1") != "L-1" or canonical_unit("Casa 1") != "Casa 1":
        raise AssertionError("whole-token rule failed")


if __name__ == "__main__":
    self_check()
    print("partner parse self-check ok")
