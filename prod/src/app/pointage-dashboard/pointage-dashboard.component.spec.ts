import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PointageDashboardComponent } from './pointage-dashboard.component';

describe('PointageDashboardComponent', () => {
  let component: PointageDashboardComponent;
  let fixture: ComponentFixture<PointageDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PointageDashboardComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(PointageDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
