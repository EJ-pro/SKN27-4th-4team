"""
Planfit Graph DB — Cypher 쿼리 모음
────────────────────────────────────
사용법:
    from db.queries import GraphQuery
    import os
    gq = GraphQuery(os.environ["NEO4J_URI"], os.environ["NEO4J_USER"], os.environ["NEO4J_PASSWORD"])
    result = gq.get_exercises_by_split("CHEST", spine="mid", equip=["dumbbell"])
    gq.close()
"""

from neo4j import GraphDatabase

DIFFICULTY_MAP = {
    "beginner":     ["beginner"],
    "intermediate": ["beginner", "intermediate"],
    "advanced":     ["beginner", "intermediate", "advanced"],
}
SPINE_MAP = {
    "all": ["상", "중", "하"],
    "mid": ["중", "하"],
    "low": ["하"],
}


class GraphQuery:
    def __init__(self, uri: str, user: str, password: str):
        self.driver = GraphDatabase.driver(uri, auth=(user, password))

    def close(self):
        self.driver.close()

    def _run(self, cypher: str, params: dict = None) -> list[dict]:
        with self.driver.session() as s:
            return [r.data() for r in s.run(cypher, params or {})]
        # 결과를 딕셔너리 리스트로  변환해서 변환
        # ->[{'id:1001 , 'name_kor': 데드리프트,..... },.....]

    # ── Q1. 분할별 운동 조회 ──────────────────────────────────────────────
    def get_exercises_by_split(
        self,
        split_day: str,
        spine: str = "all",
        equip: list[str] = None,
        level: str = "intermediate",
        limit: int = 5,
    ) -> list[dict]:
        """
        사용자 조건에 맞는 운동 목록 조회

        Args:
            split_day : 'CHEST'|'BACK'|'LEG'|'SHOULDER'|'ARM'
            spine     : 'all'|'mid'|'low'
            equip     : ['barbell','dumbbell',...] — None이면 전체
            level     : 'beginner'|'intermediate'|'advanced'
            limit     : 반환 개수
        """
        equip = equip or ["barbell", "dumbbell", "machine", "body", "pull_up_bar", "band", "kettlebell"]
        return self._run("""
            MATCH (e:Exercise {split_day: $split_day})
            WHERE e.spine_loading    IN $spine
              AND e.equipment        IN $equip
              AND e.difficulty_label IN $diff
            OPTIONAL MATCH (e)-[:TARGETS_PRIMARY]->(primary:BodyPart)
            OPTIONAL MATCH (e)-[:TARGETS_SECONDARY]->(secondary:BodyPart)
            RETURN
                e.id               AS id,
                e.name_kor         AS name_kor,
                e.name_eng         AS name_eng,
                e.equipment        AS equipment,
                e.difficulty       AS difficulty,
                e.difficulty_label AS difficulty_label,
                e.spine_loading    AS spine_loading,
                e.cal_per_min      AS cal_per_min,
                e.place_type       AS place_type,
                e.home_friendly    AS home_friendly,
                e.tag              AS tag,
                e.video_url        AS video_url,
                e.image_url        AS image_url,
                e.target_primary   AS target_primary,
                e.target_secondary AS target_secondary,
                collect(DISTINCT primary.id)   AS primary_body_parts,
                collect(DISTINCT secondary.id) AS secondary_body_parts
            ORDER BY e.difficulty ASC, e.cal_per_min DESC
            LIMIT $limit
        """, {
            "split_day": split_day,
            "spine":     SPINE_MAP.get(spine, ["상", "중", "하"]),
            "equip":     equip,
            "diff":      DIFFICULTY_MAP.get(level, ["beginner", "intermediate"]),
            "limit":     limit,
        })

    def get_exercises_by_ids(self, exercise_ids: list[int]) -> list[dict]:
        """Fetch canonical GraphDB metadata for policy-required exercises."""
        if not exercise_ids:
            return []
        return self._run("""
            MATCH (e:Exercise)
            WHERE e.id IN $exercise_ids
            OPTIONAL MATCH (e)-[:TARGETS_PRIMARY]->(primary:BodyPart)
            OPTIONAL MATCH (e)-[:TARGETS_SECONDARY]->(secondary:BodyPart)
            RETURN
                e.id               AS id,
                e.name_kor         AS name_kor,
                e.name_eng         AS name_eng,
                e.split_day        AS split_day,
                e.equipment        AS equipment,
                e.difficulty       AS difficulty,
                e.difficulty_label AS difficulty_label,
                e.spine_loading    AS spine_loading,
                e.cal_per_min      AS cal_per_min,
                e.place_type       AS place_type,
                e.home_friendly    AS home_friendly,
                e.tag              AS tag,
                e.video_url        AS video_url,
                e.image_url        AS image_url,
                e.target_primary   AS target_primary,
                e.target_secondary AS target_secondary,
                collect(DISTINCT primary.id)   AS primary_body_parts,
                collect(DISTINCT secondary.id) AS secondary_body_parts
            ORDER BY e.id
        """, {"exercise_ids": exercise_ids})

    def get_related_exercises(
        self,
        exercise_ids: list[int],
        relationship_type: str,
        split_day: str,
        spine: str = "all",
        equip: list[str] = None,
        level: str = "intermediate",
        limit: int = 20,
    ) -> list[dict]:
        """Fetch filtered one-hop graph neighbors with relation provenance."""
        allowed_relationships = {
            "SUBSTITUTE_FOR",
            "SIMILAR_TO",
            "PROGRESSION_OF",
        }
        relation = str(relationship_type or "").strip().upper()
        if not exercise_ids or relation not in allowed_relationships:
            return []

        equip = equip or ["barbell", "dumbbell", "machine", "body", "pull_up_bar", "band", "kettlebell"]
        return self._run(f"""
            MATCH (source:Exercise)-[r:{relation}]->(related:Exercise {{split_day: $split_day}})
            WHERE source.id IN $exercise_ids
              AND related.spine_loading    IN $spine
              AND related.equipment        IN $equip
              AND related.difficulty_label IN $diff
            OPTIONAL MATCH (related)-[:TARGETS_PRIMARY]->(primary:BodyPart)
            OPTIONAL MATCH (related)-[:TARGETS_SECONDARY]->(secondary:BodyPart)
            RETURN
                source.id                 AS relation_source_id,
                type(r)                   AS relation_type,
                coalesce(r.score, 0.0)     AS relation_score,
                related.id                AS id,
                related.name_kor          AS name_kor,
                related.name_eng          AS name_eng,
                related.split_day         AS split_day,
                related.equipment         AS equipment,
                related.difficulty        AS difficulty,
                related.difficulty_label  AS difficulty_label,
                related.spine_loading     AS spine_loading,
                related.cal_per_min       AS cal_per_min,
                related.place_type        AS place_type,
                related.home_friendly     AS home_friendly,
                related.tag               AS tag,
                related.video_url         AS video_url,
                related.image_url         AS image_url,
                related.target_primary    AS target_primary,
                related.target_secondary  AS target_secondary,
                collect(DISTINCT primary.id)   AS primary_body_parts,
                collect(DISTINCT secondary.id) AS secondary_body_parts
            ORDER BY relation_score DESC, related.difficulty ASC, related.cal_per_min DESC
            LIMIT $limit
        """, {
            "exercise_ids": exercise_ids,
            "split_day": split_day,
            "spine": SPINE_MAP.get(spine, ["상", "중", "하"]),
            "equip": equip,
            "diff": DIFFICULTY_MAP.get(level, ["beginner", "intermediate"]),
            "limit": limit,
        })

    # ── Q2. SUBSTITUTE_FOR — 대체 운동 조회 ──────────────────────────────
    def get_substitutes(
        self,
        exercise_id: int,
        same_place_only: bool = False,
        spine: str = "all",
    ) -> list[dict]:
        """
        exercise_edges.json 기반 SUBSTITUTE_FOR 엣지 탐색

        Args:
            exercise_id     : 운동 ID
            same_place_only : True면 같은 장소(헬스장↔헬스장)만
            spine           : 척추 부하 필터
        """
        return self._run("""
            MATCH (:Exercise {id: $id})-[r:SUBSTITUTE_FOR]->(sub:Exercise)
            WHERE sub.spine_loading IN $spine
              AND (NOT $same_place OR r.same_place = true)
            RETURN
                sub.id            AS id,
                sub.name_kor      AS name_kor,
                sub.equipment     AS equipment,
                sub.spine_loading AS spine_loading,
                sub.home_friendly AS home_friendly,
                sub.cal_per_min   AS cal_per_min,
                sub.place_type    AS place_type,
                r.from_place      AS from_place,
                r.to_place        AS to_place,
                r.same_place      AS same_place
            ORDER BY sub.spine_loading ASC, sub.cal_per_min DESC
            LIMIT 10
        """, {
            "id":         exercise_id,
            "spine":      SPINE_MAP.get(spine, ["상", "중", "하"]),
            "same_place": same_place_only,
        })

    # ── Q3. SIMILAR_TO — 유사 운동 ───────────────────────────────────────
    def get_similar(self, exercise_id: int, limit: int = 5) -> list[dict]:
        """related_exercises 기반 유사 운동"""
        return self._run("""
            MATCH (:Exercise {id: $id})-[r:SIMILAR_TO]->(s:Exercise)
            RETURN
                s.id               AS id,
                s.name_kor         AS name_kor,
                s.equipment        AS equipment,
                s.spine_loading    AS spine_loading,
                s.difficulty_label AS difficulty_label,
                r.score            AS score
            ORDER BY r.score DESC
            LIMIT $limit
        """, {"id": exercise_id, "limit": limit})

    # ── Q4. PROGRESSION_OF — 점진 과부하 경로 ────────────────────────────
    def get_progression(self, exercise_id: int, steps: int = 3) -> list[dict]:
        """difficulty 기반 점진 과부하 경로"""
        rows = self._run("""
            MATCH path = (start:Exercise {id: $id})
                         -[:PROGRESSION_OF*1..$steps]->(adv:Exercise)
            RETURN [n IN nodes(path) | {
                id:               n.id,
                name_kor:         n.name_kor,
                difficulty:       n.difficulty,
                difficulty_label: n.difficulty_label
            }] AS chain
            LIMIT 1
        """, {"id": exercise_id, "steps": steps})
        return rows[0]["chain"] if rows else []

    # # ── Q5. ARM_SUPERSET — 팔 슈퍼셋 ─────────────────────────────────────
    # def get_arm_supersets(
    #     self,
    #     equip: list[str] = None,
    #     limit: int = 3,
    # ) -> list[dict]:
    #     """이두↔삼두 ARM_SUPERSET 쌍 조회"""
    #     equip = equip or ["barbell", "dumbbell", "machine", "body"]
    #     return self._run("""
    #         MATCH (bi:Exercise)-[:TARGETS_PRIMARY]->(:BodyPart {id: 'bp_biceps'}),
    #               (bi)-[:ARM_SUPERSET]->(tri:Exercise),
    #               (tri)-[:TARGETS_PRIMARY]->(:BodyPart {id: 'bp_triceps'})
    #         WHERE bi.equipment  IN $equip
    #           AND tri.equipment IN $equip
    #         RETURN
    #             bi.id            AS bi_id,
    #             bi.name_kor      AS bi_name,
    #             bi.equipment     AS bi_equip,
    #             bi.spine_loading AS bi_spine,
    #             tri.id           AS tri_id,
    #             tri.name_kor     AS tri_name,
    #             tri.equipment    AS tri_equip,
    #             tri.spine_loading AS tri_spine
    #         LIMIT $limit
    #     """, {"equip": equip, "limit": limit})

    # ── Q6. 주간 칼로리 합산 ──────────────────────────────────────────────
    def get_weekly_calories(self, weight: float = 70.0) -> list[dict]:
        """분할별 예상 칼로리 (체중 보정)"""
        return self._run("""
            MATCH (e:Exercise)-[rel:PART_OF_SPLIT]->(s:SplitDay)
            RETURN
                s.split_day  AS split,
                s.name       AS name,
                s.order      AS order,
                s.weekday    AS weekday,
                round(SUM(e.cal_per_min * ($weight / 70.0) * rel.duration_min)) AS kcal
            ORDER BY s.order
        """, {"weight": weight})

    # ── Q7. 척추 안전 운동 ────────────────────────────────────────────────
    def get_spine_safe(self, split_day: str, spine: str = "low") -> list[dict]:
        """재활/허리 보호용 척추 부하 낮은 운동"""
        return self._run("""
            MATCH (e:Exercise {split_day: $split_day})
            WHERE e.spine_loading IN $spine
            RETURN
                e.id            AS id,
                e.name_kor      AS name_kor,
                e.equipment     AS equipment,
                e.spine_loading AS spine_loading,
                e.home_friendly AS home_friendly,
                e.cal_per_min   AS cal_per_min,
                e.difficulty_label AS difficulty_label
            ORDER BY e.cal_per_min DESC
        """, {
            "split_day": split_day,
            "spine":     SPINE_MAP.get(spine, ["하"]),
        })

    # ── Q8. 분할 통계 ────────────────────────────────────────────────────
    def get_split_stats(self) -> list[dict]:
        """분할별 운동 수, 평균 칼로리, 척추 부하 분포"""
        return self._run("""
            MATCH (e:Exercise)
            WHERE e.split_day IS NOT NULL
            RETURN
                e.split_day AS split,
                count(e)    AS total,
                round(avg(e.cal_per_min) * 10) / 10 AS avg_cal,
                sum(CASE WHEN e.spine_loading = '상' THEN 1 ELSE 0 END) AS spine_high,
                sum(CASE WHEN e.spine_loading = '중' THEN 1 ELSE 0 END) AS spine_mid,
                sum(CASE WHEN e.spine_loading = '하' THEN 1 ELSE 0 END) AS spine_low
            ORDER BY split
        """)
