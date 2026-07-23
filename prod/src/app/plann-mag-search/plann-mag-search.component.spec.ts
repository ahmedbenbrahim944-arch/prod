import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlannMagSearchComponent } from './plann-mag-search.component';

describe('PlannMagSearchComponent', () => {
  let component: PlannMagSearchComponent;
  let fixture: ComponentFixture<PlannMagSearchComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlannMagSearchComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(PlannMagSearchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
